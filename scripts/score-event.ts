#!/usr/bin/env npx tsx
// ═══════════════════════════════════════════════════════════════
// Manual Event Scorer — Score or re-score a single event
//
// Usage:
//   npx tsx scripts/score-event.ts <event_id>
//   npx tsx scripts/score-event.ts <event_id> --force   # Override frozen status
// ═══════════════════════════════════════════════════════════════

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const eventId = process.argv[2];
const force = process.argv.includes('--force');

if (!eventId) {
  console.error('Usage: npx tsx scripts/score-event.ts <event_id> [--force]');
  process.exit(1);
}

async function main() {
  // Fetch event
  const { data: event, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (error || !event) {
    console.error('Event not found:', eventId);
    process.exit(1);
  }

  console.log(`Event: "${event.title}"`);
  console.log(`  Week: ${event.week_id} | List: ${event.primary_list} | Frozen: ${event.score_frozen}`);
  console.log(`  A: ${event.a_score} | B: ${event.b_score}`);

  if (event.score_frozen && !force) {
    console.error('Event is frozen. Use --force to override.');
    process.exit(1);
  }

  // Fetch articles
  const { data: articles } = await supabase
    .from('articles')
    .select('headline')
    .eq('event_id', eventId);

  const headlines = (articles || []).map((a) => a.headline).filter(Boolean);
  console.log(`  Articles: ${headlines.length}`);

  // Score using the API route
  const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/score`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
    body: JSON.stringify({ event_id: eventId }),
  });

  const result = await response.json();

  if (result.success) {
    console.log('\n✓ Re-scored successfully:');
    console.log(`  A: ${result.a_score} | B: ${result.b_score} | List: ${result.primary_list}`);
    console.log(`  Mixed: ${result.is_mixed} | Version: ${result.version}`);
    console.log(`  Tokens: ${result.tokens.input + result.tokens.output}`);
  } else {
    console.error('\n✗ Scoring failed:', result.error);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
