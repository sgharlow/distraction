#!/usr/bin/env npx tsx
// ═══════════════════════════════════════════════════════════════
// Fix Data Quality — Normalize primary_list casing & cap A-scores
//
// 1. Normalizes primary_list values to 'A', 'B', or 'C'
// 2. Caps any a_score > 100 to 100.0
// 3. Reports final distribution
//
// Usage:
//   npx tsx scripts/fix-data-quality.ts
// ═══════════════════════════════════════════════════════════════

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE env vars');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? 'SET' : 'MISSING');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_KEY ? 'SET' : 'MISSING');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: { schema: 'distraction' },
});

// Mapping of variant values to their canonical form
const LIST_NORMALIZATION: Record<string, string> = {
  // Already correct
  'A': 'A',
  'B': 'B',
  'C': 'C',
  // A variants
  'a': 'A',
  'DAMAGE': 'A',
  'damage': 'A',
  'Damage': 'A',
  // B variants
  'b': 'B',
  'DISTRACTION': 'B',
  'distraction': 'B',
  'Distraction': 'B',
  // C variants (noise/neither/none)
  'NOISE': 'C',
  'noise': 'C',
  'Noise': 'C',
  'Neither': 'C',
  'neither': 'C',
  'NEITHER': 'C',
  'None': 'C',
  'none': 'C',
  'NONE': 'C',
};

async function fetchAllEvents(): Promise<Array<{
  id: string;
  title: string;
  a_score: number;
  primary_list: string;
}>> {
  const allEvents: Array<{
    id: string;
    title: string;
    a_score: number;
    primary_list: string;
  }> = [];

  let offset = 0;
  const batchSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('events')
      .select('id, title, a_score, primary_list')
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

  return allEvents;
}

async function main() {
  console.log('============================================================');
  console.log('  Fix Data Quality -- primary_list normalization & a_score cap');
  console.log('============================================================');
  console.log('Supabase URL: ' + SUPABASE_URL);
  console.log('Timestamp: ' + new Date().toISOString());
  console.log('');

  // ─────────────────────────────────────────────────────────────
  // Fetch all events
  // ─────────────────────────────────────────────────────────────
  const allEvents = await fetchAllEvents();
  console.log('Total events fetched: ' + allEvents.length);
  console.log('');

  // ─────────────────────────────────────────────────────────────
  // STEP 1: Normalize primary_list casing
  // ─────────────────────────────────────────────────────────────
  console.log('------------------------------------------------------------');
  console.log('  STEP 1: Normalize primary_list casing');
  console.log('------------------------------------------------------------');

  // Show current distribution
  const currentDist: Record<string, number> = {};
  for (const e of allEvents) {
    const val = e.primary_list ?? '(null)';
    currentDist[val] = (currentDist[val] || 0) + 1;
  }
  console.log('\nCurrent primary_list distribution:');
  for (const [val, count] of Object.entries(currentDist).sort((a, b) => b[1] - a[1])) {
    const ok = ['A', 'B', 'C'].includes(val);
    console.log('  "' + val + '": ' + count + (ok ? '' : '  <-- NEEDS FIX'));
  }

  // Group events that need updating by their target value
  // We'll batch update: all events going to 'A', all going to 'B', all going to 'C'
  const toA: string[] = [];
  const toB: string[] = [];
  const toC: string[] = [];
  const unknown: Array<{ id: string; value: string }> = [];

  for (const e of allEvents) {
    const current = e.primary_list;
    if (current === 'A' || current === 'B' || current === 'C') continue; // already correct

    const normalized = LIST_NORMALIZATION[current];
    if (!normalized) {
      unknown.push({ id: e.id, value: current });
      continue;
    }

    if (normalized === 'A') toA.push(e.id);
    else if (normalized === 'B') toB.push(e.id);
    else if (normalized === 'C') toC.push(e.id);
  }

  if (unknown.length > 0) {
    console.log('\nWARNING: ' + unknown.length + ' events have unrecognized primary_list values:');
    for (const u of unknown.slice(0, 20)) {
      console.log('  id=' + u.id + '  value="' + u.value + '"');
    }
    if (unknown.length > 20) console.log('  ... and ' + (unknown.length - 20) + ' more');
  }

  const totalToFix = toA.length + toB.length + toC.length;
  console.log('\nEvents to normalize: ' + totalToFix);
  console.log('  -> A: ' + toA.length + ' events');
  console.log('  -> B: ' + toB.length + ' events');
  console.log('  -> C: ' + toC.length + ' events');

  // Apply updates
  let listUpdated = 0;
  let listErrors = 0;

  async function batchUpdate(ids: string[], newValue: string, label: string) {
    if (ids.length === 0) return;
    // Process in sub-batches of 100
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      const { error } = await supabase
        .from('events')
        .update({ primary_list: newValue })
        .in('id', batch);

      if (error) {
        console.error('  FAILED updating batch to ' + label + ': ' + error.message);
        listErrors += batch.length;
      } else {
        listUpdated += batch.length;
        console.log('  Updated ' + batch.length + ' events -> "' + label + '"');
      }
    }
  }

  await batchUpdate(toA, 'A', 'A');
  await batchUpdate(toB, 'B', 'B');
  await batchUpdate(toC, 'C', 'C');

  console.log('\nStep 1 complete: ' + listUpdated + ' updated, ' + listErrors + ' errors');

  // ─────────────────────────────────────────────────────────────
  // STEP 2: Cap a_score > 100
  // ─────────────────────────────────────────────────────────────
  console.log('');
  console.log('------------------------------------------------------------');
  console.log('  STEP 2: Cap a_score values > 100');
  console.log('------------------------------------------------------------');

  const overCapped = allEvents.filter(e => e.a_score > 100);
  console.log('\nEvents with a_score > 100: ' + overCapped.length);

  if (overCapped.length > 0) {
    console.log('\nEvents to cap:');
    for (const e of overCapped) {
      console.log('  title="' + e.title + '"  a_score=' + e.a_score + ' -> 100.0');
    }

    const overCappedIds = overCapped.map(e => e.id);

    // Update in batches of 100
    let scoreUpdated = 0;
    let scoreErrors = 0;
    for (let i = 0; i < overCappedIds.length; i += 100) {
      const batch = overCappedIds.slice(i, i + 100);
      const { error } = await supabase
        .from('events')
        .update({ a_score: 100.0 })
        .in('id', batch);

      if (error) {
        console.error('  FAILED capping batch: ' + error.message);
        scoreErrors += batch.length;
      } else {
        scoreUpdated += batch.length;
      }
    }

    console.log('\nStep 2 complete: ' + scoreUpdated + ' capped, ' + scoreErrors + ' errors');
  } else {
    console.log('No a_score values exceed 100. Nothing to cap.');
    console.log('\nStep 2 complete: 0 capped, 0 errors');
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 3: Final distribution report
  // ─────────────────────────────────────────────────────────────
  console.log('');
  console.log('------------------------------------------------------------');
  console.log('  STEP 3: Final Distribution Report');
  console.log('------------------------------------------------------------');

  // Re-fetch to verify
  const finalEvents = await fetchAllEvents();

  // primary_list distribution
  const finalDist: Record<string, number> = {};
  for (const e of finalEvents) {
    const val = e.primary_list ?? '(null)';
    finalDist[val] = (finalDist[val] || 0) + 1;
  }

  console.log('\nFinal primary_list distribution:');
  for (const [val, count] of Object.entries(finalDist).sort((a, b) => b[1] - a[1])) {
    const ok = ['A', 'B', 'C'].includes(val);
    console.log('  "' + val + '": ' + count + (ok ? ' (ok)' : ' (UNEXPECTED)'));
  }

  // a_score > 100 check
  const stillOver100 = finalEvents.filter(e => e.a_score > 100);
  console.log('\nEvents with a_score > 100: ' + stillOver100.length + (stillOver100.length === 0 ? ' (ok)' : ' (PROBLEM)'));

  if (stillOver100.length > 0) {
    for (const e of stillOver100) {
      console.log('  id=' + e.id + '  a_score=' + e.a_score + '  title="' + e.title + '"');
    }
  }

  console.log('\n============================================================');
  console.log('  DATA QUALITY FIX COMPLETE');
  console.log('============================================================');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
