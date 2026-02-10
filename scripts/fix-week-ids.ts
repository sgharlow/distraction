#!/usr/bin/env npx tsx
// ═══════════════════════════════════════════════════════════════
// Fix Week IDs — Corrects timezone-shifted week_ids in the database
//
// The backfill script parsed dates as UTC midnight but formatted in local
// time, causing every week_id to be 1-2 days before the true Sunday start.
// This script corrects all week_ids to proper Sunday-start dates.
//
// Usage:
//   npx tsx scripts/fix-week-ids.ts --dry-run   # Preview changes
//   npx tsx scripts/fix-week-ids.ts              # Apply changes
// ═══════════════════════════════════════════════════════════════

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DRY_RUN = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: { schema: 'distraction' },
});

/**
 * Given a stored week_id (which is off by 1-2 days due to UTC→local shift),
 * find the correct Sunday-start date.
 */
function getCorrectSunday(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day); // local time
  const dayOfWeek = d.getDay(); // 0 = Sunday

  // Advance to next Sunday (or stay if already Sunday)
  if (dayOfWeek !== 0) {
    d.setDate(d.getDate() + (7 - dayOfWeek));
  }

  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Compute Saturday end date from Sunday start.
 */
function getSaturday(sundayStr: string): string {
  const [year, month, day] = sundayStr.split('-').map(Number);
  const d = new Date(year, month - 1, day + 6);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// Child tables that reference weekly_snapshots(week_id)
// Note: pipeline_runs does NOT have a week_id column despite the migration file
const CHILD_TABLES = [
  'events',
  'articles',
  'smokescreen_pairs',
  'score_changes',
  'community_flags',
];

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   Fix Week IDs — UTC→Local Correction    ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  // 1. Get all weekly_snapshots
  const { data: snapshots, error } = await supabase
    .from('weekly_snapshots')
    .select('*')
    .order('week_id', { ascending: true });

  if (error) {
    console.error('Failed to fetch snapshots:', error.message);
    process.exit(1);
  }

  console.log(`Found ${snapshots.length} weekly snapshots\n`);

  // 2. Compute mappings (old_id → correct_sunday)
  type Mapping = {
    oldId: string;
    newId: string;
    snapshot: typeof snapshots[0];
  };

  const mappings: Mapping[] = [];
  const collisions = new Map<string, string[]>(); // newId → [oldIds]

  for (const snap of snapshots) {
    const correctId = getCorrectSunday(snap.week_id);
    if (!collisions.has(correctId)) {
      collisions.set(correctId, []);
    }
    collisions.get(correctId)!.push(snap.week_id);

    if (snap.week_id !== correctId) {
      mappings.push({ oldId: snap.week_id, newId: correctId, snapshot: snap });
    }
  }

  // 3. Report
  console.log('Week ID mappings:');
  let alreadyCorrect = 0;
  for (const snap of snapshots) {
    const correctId = getCorrectSunday(snap.week_id);
    if (snap.week_id === correctId) {
      alreadyCorrect++;
    } else {
      console.log(`  ${snap.week_id} → ${correctId}`);
    }
  }
  console.log(`  (${alreadyCorrect} already correct)`);

  // Check for collisions
  const realCollisions = Array.from(collisions.entries()).filter(
    ([, oldIds]) => oldIds.length > 1
  );
  if (realCollisions.length > 0) {
    console.log('\n⚠ COLLISIONS detected (multiple old IDs → same new ID):');
    for (const [newId, oldIds] of realCollisions) {
      console.log(`  ${oldIds.join(', ')} → ${newId} (will merge)`);
    }
  }

  console.log(`\nTotal updates needed: ${mappings.length}`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes applied.');
    return;
  }

  // 4. Apply updates — process each mapping
  let success = 0;
  let errors = 0;

  for (const { oldId, newId, snapshot } of mappings) {
    console.log(`\n--- Updating ${oldId} → ${newId} ---`);

    // Check if the target week_id already exists in weekly_snapshots
    const { data: existing } = await supabase
      .from('weekly_snapshots')
      .select('week_id')
      .eq('week_id', newId)
      .maybeSingle();

    if (!existing) {
      // Insert new snapshot with corrected week_id
      const weekEnd = getSaturday(newId);
      const newSnap = {
        week_id: newId,
        week_start: newId,
        week_end: weekEnd,
        status: snapshot.status,
        frozen_at: snapshot.frozen_at,
        top_smokescreen_index: snapshot.top_smokescreen_index,
        top_smokescreen_pair: snapshot.top_smokescreen_pair,
        total_events: snapshot.total_events,
        list_a_count: snapshot.list_a_count,
        list_b_count: snapshot.list_b_count,
        list_c_count: snapshot.list_c_count,
        avg_a_score: snapshot.avg_a_score,
        avg_b_score: snapshot.avg_b_score,
        total_articles: snapshot.total_articles,
        total_primary_docs: snapshot.total_primary_docs,
        avg_attention_budget: snapshot.avg_attention_budget,
        weekly_summary: snapshot.weekly_summary,
      };

      const { error: insertErr } = await supabase
        .from('weekly_snapshots')
        .insert(newSnap);

      if (insertErr) {
        console.error(`  ✗ Failed to insert new snapshot: ${insertErr.message}`);
        errors++;
        continue;
      }
      console.log(`  ✓ Inserted new snapshot ${newId}`);
    } else {
      console.log(`  → Target snapshot ${newId} already exists`);
    }

    // Update all child tables
    let childErrors = false;
    for (const table of CHILD_TABLES) {
      const { error: updateErr, count } = await supabase
        .from(table)
        .update({ week_id: newId })
        .eq('week_id', oldId);

      if (updateErr) {
        console.error(`  ✗ Failed to update ${table}: ${updateErr.message}`);
        childErrors = true;
      } else {
        // Count rows for reporting
        const { count: rowCount } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })
          .eq('week_id', newId);
        console.log(`  ✓ Updated ${table}`);
      }
    }

    if (childErrors) {
      console.error(`  ✗ Skipping deletion of ${oldId} due to child errors`);
      errors++;
      continue;
    }

    // Delete old snapshot (now unreferenced)
    const { error: deleteErr } = await supabase
      .from('weekly_snapshots')
      .delete()
      .eq('week_id', oldId);

    if (deleteErr) {
      console.error(`  ✗ Failed to delete old snapshot: ${deleteErr.message}`);
      errors++;
    } else {
      console.log(`  ✓ Deleted old snapshot ${oldId}`);
      success++;
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`COMPLETE: ${success} updated, ${errors} errors`);

  // 5. Verify final state
  const { data: finalSnaps } = await supabase
    .from('weekly_snapshots')
    .select('week_id')
    .order('week_id', { ascending: true });

  if (finalSnaps) {
    console.log(`\nFinal weekly_snapshots (${finalSnaps.length}):`);
    for (const s of finalSnaps) {
      const [y, m, d] = s.week_id.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getDay()];
      const marker = dt.getDay() === 0 ? '✓' : '✗';
      console.log(`  ${s.week_id} (${dayName}) ${marker}`);
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
