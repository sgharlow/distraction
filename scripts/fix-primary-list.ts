#!/usr/bin/env npx tsx
// ═══════════════════════════════════════════════════════════════
// Fix primary_list values — Normalize full-word values to CHAR(1)
//
// The backfill script stored LLM raw output ('Noise', 'Mixed', etc.)
// instead of the classify.ts output ('A', 'B', 'C'). This script
// reclassifies all events using the spec's dominance margin logic.
//
// Usage:
//   npx tsx scripts/fix-primary-list.ts --dry-run   # Preview changes
//   npx tsx scripts/fix-primary-list.ts              # Apply changes
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

// Reclassify using the spec's dominance margin logic (same as classify.ts)
function classifyFromScores(
  a_score: number,
  b_score: number,
  mechanism_of_harm: string | null,
  oldList: string,
): { primary_list: string; is_mixed: boolean; noise_flag: boolean } {
  const D = a_score - b_score;

  // Noise gate: A < 25, mechanism is norm_erosion_only or null, and
  // the old classification indicated noise
  const wasNoise = ['Noise', 'NOISE', 'noise', 'N'].includes(oldList);
  const isLowMechanism = !mechanism_of_harm || mechanism_of_harm === 'norm_erosion_only';

  if (a_score < 25 && isLowMechanism && wasNoise) {
    return { primary_list: 'C', is_mixed: false, noise_flag: true };
  }

  // Clear A-dominant
  if (a_score >= 25 && D >= 10) {
    return { primary_list: 'A', is_mixed: false, noise_flag: false };
  }

  // Clear B-dominant
  if (b_score >= 25 && D <= -10) {
    return { primary_list: 'B', is_mixed: false, noise_flag: false };
  }

  // Mixed: both >= 25 but margin < 10
  if (a_score >= 25 && b_score >= 25 && Math.abs(D) < 10) {
    const list = a_score >= b_score ? 'A' : 'B';
    return { primary_list: list, is_mixed: true, noise_flag: false };
  }

  // Low salience: both < 25
  if (a_score < 25 && b_score < 25) {
    return { primary_list: 'C', is_mixed: false, noise_flag: false };
  }

  // Edge case: one score >= 25 but margin not met
  const list = a_score >= b_score ? 'A' : 'B';
  return { primary_list: list, is_mixed: false, noise_flag: false };
}

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   Fix primary_list — Normalize to A/B/C     ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  // Fetch ALL events (need to paginate since > 1000)
  const allEvents: Array<{
    id: string;
    a_score: number;
    b_score: number;
    primary_list: string;
    is_mixed: boolean;
    noise_flag: boolean;
    mechanism_of_harm: string | null;
  }> = [];

  let offset = 0;
  const batchSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('events')
      .select('id, a_score, b_score, primary_list, is_mixed, noise_flag, mechanism_of_harm')
      .range(offset, offset + batchSize - 1)
      .order('id');

    if (error) {
      console.error('Failed to fetch events:', error.message);
      process.exit(1);
    }

    if (!data || data.length === 0) break;
    allEvents.push(...data);
    if (data.length < batchSize) break;
    offset += batchSize;
  }

  console.log(`Total events fetched: ${allEvents.length}\n`);

  // Categorize current state
  const valueCounts: Record<string, number> = {};
  for (const e of allEvents) {
    valueCounts[e.primary_list] = (valueCounts[e.primary_list] || 0) + 1;
  }
  console.log('Current primary_list distribution:');
  for (const [val, count] of Object.entries(valueCounts).sort((a, b) => b[1] - a[1])) {
    const marker = ['A', 'B', 'C'].includes(val) ? '  ✓' : '  ✗ NEEDS FIX';
    console.log(`  "${val}": ${count}${marker}`);
  }

  // Find events that need fixing
  const needsFix = allEvents.filter(
    (e) => !['A', 'B', 'C'].includes(e.primary_list),
  );

  console.log(`\nEvents needing fix: ${needsFix.length} / ${allEvents.length}\n`);

  if (needsFix.length === 0) {
    console.log('Nothing to fix!');
    return;
  }

  // Compute new classifications
  const updates: Array<{
    id: string;
    old_list: string;
    new_list: string;
    is_mixed: boolean;
    noise_flag: boolean;
  }> = [];

  for (const e of needsFix) {
    const result = classifyFromScores(
      e.a_score,
      e.b_score,
      e.mechanism_of_harm,
      e.primary_list,
    );

    updates.push({
      id: e.id,
      old_list: e.primary_list,
      new_list: result.primary_list,
      is_mixed: result.is_mixed,
      noise_flag: result.noise_flag,
    });
  }

  // Report changes
  const changeStats: Record<string, Record<string, number>> = {};
  for (const u of updates) {
    const key = `${u.old_list} → ${u.new_list}`;
    changeStats[key] = changeStats[key] || {};
    changeStats[key].count = (changeStats[key].count || 0) + 1;
  }

  console.log('Planned changes:');
  for (const [change, stats] of Object.entries(changeStats).sort(
    (a, b) => b[1].count - a[1].count,
  )) {
    console.log(`  ${change}: ${stats.count} events`);
  }

  // New distribution after fix
  const newCounts: Record<string, number> = { A: 0, B: 0, C: 0 };
  for (const e of allEvents) {
    if (['A', 'B', 'C'].includes(e.primary_list)) {
      newCounts[e.primary_list]++;
    }
  }
  for (const u of updates) {
    newCounts[u.new_list]++;
  }
  console.log('\nProjected distribution after fix:');
  for (const [list, count] of Object.entries(newCounts)) {
    console.log(`  ${list}: ${count}`);
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes applied.');
    return;
  }

  // Apply updates in batches
  console.log('\nApplying updates...');
  let success = 0;
  let errors = 0;

  // Group by new values to do batch updates
  const byNewValues: Record<string, string[]> = {};
  for (const u of updates) {
    const key = `${u.new_list}|${u.is_mixed}|${u.noise_flag}`;
    if (!byNewValues[key]) byNewValues[key] = [];
    byNewValues[key].push(u.id);
  }

  for (const [key, ids] of Object.entries(byNewValues)) {
    const [newList, isMixed, noiseFlag] = key.split('|');

    // Process in sub-batches of 100 to avoid query size limits
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);

      const { error: updateErr } = await supabase
        .from('events')
        .update({
          primary_list: newList,
          is_mixed: isMixed === 'true',
          noise_flag: noiseFlag === 'true',
        })
        .in('id', batch);

      if (updateErr) {
        console.error(`  ✗ Failed batch (${newList}, mixed=${isMixed}): ${updateErr.message}`);
        errors += batch.length;
      } else {
        success += batch.length;
        console.log(`  ✓ Updated ${batch.length} events → ${newList} (mixed=${isMixed}, noise=${noiseFlag})`);
      }
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`COMPLETE: ${success} updated, ${errors} errors`);

  // Verify final state
  const { data: finalCounts } = await supabase
    .from('events')
    .select('primary_list');

  if (finalCounts) {
    const finalDist: Record<string, number> = {};
    for (const e of finalCounts) {
      finalDist[e.primary_list] = (finalDist[e.primary_list] || 0) + 1;
    }
    console.log('\nFinal primary_list distribution:');
    for (const [val, count] of Object.entries(finalDist).sort((a, b) => b[1] - a[1])) {
      const marker = ['A', 'B', 'C'].includes(val) ? '✓' : '✗';
      console.log(`  ${marker} "${val}": ${count}`);
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
