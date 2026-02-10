#!/usr/bin/env npx tsx
// ═══════════════════════════════════════════════════════════════
// Manual Week Freezer — Freeze a specific week
//
// Usage:
//   npx tsx scripts/freeze-week.ts <week_id>
//   npx tsx scripts/freeze-week.ts 2026-02-02
// ═══════════════════════════════════════════════════════════════

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const weekId = process.argv[2];

if (!weekId) {
  console.error('Usage: npx tsx scripts/freeze-week.ts <week_id>');
  console.error('Example: npx tsx scripts/freeze-week.ts 2026-02-02');
  process.exit(1);
}

async function main() {
  console.log(`Freezing week: ${weekId}`);

  const { data, error } = await supabase.rpc('freeze_week', {
    target_week_id: weekId,
  });

  if (error) {
    console.error('Freeze error:', error.message);
    process.exit(1);
  }

  console.log('Result:', JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
