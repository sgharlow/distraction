#!/usr/bin/env npx tsx
// Recompute all weekly snapshot aggregate stats after primary_list fix.

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: 'distraction' } },
);

async function main() {
  // Get all snapshots
  const { data: snapshots, error } = await supabase
    .from('weekly_snapshots')
    .select('week_id, total_events, list_a_count, list_b_count, list_c_count')
    .order('week_id', { ascending: true });

  if (error) throw error;

  console.log(`Recomputing stats for ${snapshots.length} weekly snapshots...\n`);

  let updated = 0;
  let errors = 0;

  for (const snap of snapshots) {
    const { error: rpcErr } = await supabase.rpc('compute_week_stats', {
      target_week_id: snap.week_id,
    });

    if (rpcErr) {
      console.error(`  ✗ ${snap.week_id}: ${rpcErr.message}`);
      errors++;
    } else {
      updated++;
    }
  }

  console.log(`\nRecomputed: ${updated}, errors: ${errors}`);

  // Verify a sample
  console.log('\nSample results (first 10 + last 5):');
  const { data: results } = await supabase
    .from('weekly_snapshots')
    .select('week_id, total_events, list_a_count, list_b_count, list_c_count, avg_a_score, avg_b_score, max_smokescreen_index, week_attention_budget, total_sources')
    .order('week_id', { ascending: true });

  if (results) {
    const show = [...results.slice(0, 10), ...results.slice(-5)];
    console.log('week_id        | events | A  | B  | C  | avgA  | avgB  | maxSI  | attnBdg | srcs');
    console.log('-'.repeat(100));
    for (const r of show) {
      const avgA = r.avg_a_score !== null ? r.avg_a_score.toFixed(1) : '--';
      const avgB = r.avg_b_score !== null ? r.avg_b_score.toFixed(1) : '--';
      const maxSI = r.max_smokescreen_index !== null ? r.max_smokescreen_index.toFixed(1) : '--';
      const attn = r.week_attention_budget !== null ? r.week_attention_budget.toFixed(1) : '--';
      console.log(
        `${r.week_id}  | ${String(r.total_events).padStart(6)} | ${String(r.list_a_count).padStart(2)} | ${String(r.list_b_count).padStart(2)} | ${String(r.list_c_count).padStart(2)} | ${avgA.padStart(5)} | ${avgB.padStart(5)} | ${maxSI.padStart(6)} | ${attn.padStart(7)} | ${String(r.total_sources).padStart(4)}`
      );
    }
  }
}

main().catch(console.error);
