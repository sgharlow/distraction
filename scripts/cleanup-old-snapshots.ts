#!/usr/bin/env npx tsx
// Delete old (non-Sunday) weekly_snapshots that are now orphaned
// after the week_id fix migrated all child rows to correct Sunday week_ids.

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
    .select('week_id')
    .order('week_id', { ascending: true });

  if (error) throw error;

  // Find non-Sunday week_ids
  const toDelete: string[] = [];
  for (const s of snapshots) {
    const [y, m, d] = s.week_id.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (dt.getDay() !== 0) {
      toDelete.push(s.week_id);
    }
  }

  console.log(`Found ${toDelete.length} non-Sunday snapshots to delete:`);
  for (const wid of toDelete) {
    console.log(`  ${wid}`);
  }

  // Verify no child rows reference these week_ids
  const childTables = ['events', 'articles', 'smokescreen_pairs'];
  for (const table of childTables) {
    for (const wid of toDelete) {
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('week_id', wid);
      if (count && count > 0) {
        console.error(`ERROR: ${table} still has ${count} rows with week_id=${wid}`);
        process.exit(1);
      }
    }
  }
  console.log('\nVerified: no child rows reference old week_ids.');

  // Delete them
  let deleted = 0;
  for (const wid of toDelete) {
    const { error: delErr } = await supabase
      .from('weekly_snapshots')
      .delete()
      .eq('week_id', wid);
    if (delErr) {
      console.error(`Failed to delete ${wid}: ${delErr.message}`);
    } else {
      deleted++;
    }
  }

  console.log(`\nDeleted ${deleted}/${toDelete.length} old snapshots.`);

  // Final count
  const { count } = await supabase
    .from('weekly_snapshots')
    .select('*', { count: 'exact', head: true });
  console.log(`Remaining snapshots: ${count}`);
}

main().catch(console.error);
