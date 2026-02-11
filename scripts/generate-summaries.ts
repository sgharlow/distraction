#!/usr/bin/env npx tsx
// ═══════════════════════════════════════════════════════════════
// Generate weekly editorial summaries for frozen weeks
// Uses Claude Haiku to generate concise "WHAT ACTUALLY MATTERED"
// summaries from event data.
//
// Usage:
//   npx tsx scripts/generate-summaries.ts           # all weeks without summaries
//   npx tsx scripts/generate-summaries.ts --week 2025-03-16  # specific week
//   npx tsx scripts/generate-summaries.ts --dry-run  # preview without saving
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: 'distraction' } }
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const weekFlag = args.indexOf('--week');
const specificWeek = weekFlag !== -1 ? args[weekFlag + 1] : null;

async function generateSummary(weekId: string): Promise<string | null> {
  // Fetch events for this week
  const { data: events } = await supabase
    .from('events')
    .select('title, primary_list, a_score, b_score, summary, mechanism_of_harm, action_item')
    .eq('week_id', weekId)
    .not('primary_list', 'is', null)
    .order('a_score', { ascending: false, nullsFirst: false });

  if (!events || events.length === 0) return null;

  const listA = events.filter((e) => e.primary_list === 'A');
  const listB = events.filter((e) => e.primary_list === 'B');

  const prompt = `You are the editorial voice of The Distraction Index, a civic intelligence publication that tracks constitutional damage vs. manufactured distractions during the Trump administration.

Write a 2-3 sentence editorial summary for this week under the heading "WHAT ACTUALLY MATTERED." The summary should:
1. Highlight the most significant List A (constitutional damage) events
2. Note the primary distraction patterns (List B)
3. Be direct, factual, and non-partisan
4. Use present tense for ongoing situations
5. Maximum 200 words
6. Do NOT include any heading, title, or markdown — just the plain text summary

LIST A — REAL DAMAGE (${listA.length} events):
${listA.map((e) => `- ${e.title} (A: ${e.a_score?.toFixed(1)}) — ${e.summary?.slice(0, 150)}`).join('\n')}

LIST B — DISTRACTIONS (${listB.length} events):
${listB.map((e) => `- ${e.title} (B: ${e.b_score?.toFixed(1)}) — ${e.summary?.slice(0, 150)}`).join('\n')}

Total events this week: ${events.length}

Return ONLY the summary text, no quotes or formatting.`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    temperature: 0.3,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : null;
  return text;
}

async function main() {
  console.log(`${dryRun ? '[DRY RUN] ' : ''}Generating weekly summaries...\n`);

  // Get all frozen weeks without summaries
  let query = supabase
    .from('weekly_snapshots')
    .select('week_id, status, weekly_summary, total_events')
    .eq('status', 'frozen')
    .order('week_start', { ascending: false });

  if (specificWeek) {
    query = query.eq('week_id', specificWeek);
  } else {
    query = query.is('weekly_summary', null);
  }

  const { data: weeks, error } = await query;

  if (error) {
    console.error('Error fetching weeks:', error);
    process.exit(1);
  }

  if (!weeks || weeks.length === 0) {
    console.log('No weeks need summaries.');
    return;
  }

  console.log(`Found ${weeks.length} week(s) to process.\n`);

  let generated = 0;
  let skipped = 0;

  for (const week of weeks) {
    if (week.total_events === 0) {
      console.log(`  ${week.week_id}: 0 events, skipping`);
      skipped++;
      continue;
    }

    console.log(`  ${week.week_id}: generating summary (${week.total_events} events)...`);

    try {
      const summary = await generateSummary(week.week_id);

      if (!summary) {
        console.log(`    → no events, skipped`);
        skipped++;
        continue;
      }

      console.log(`    → "${summary.slice(0, 100)}..."`);

      if (!dryRun) {
        const { error: updateError } = await supabase
          .from('weekly_snapshots')
          .update({ weekly_summary: summary })
          .eq('week_id', week.week_id);

        if (updateError) {
          console.error(`    → ERROR saving: ${updateError.message}`);
        } else {
          console.log(`    → saved`);
        }
      }

      generated++;

      // Small delay to avoid rate limits
      await new Promise((r) => setTimeout(r, 1000));
    } catch (err) {
      console.error(`    → ERROR: ${err}`);
    }
  }

  console.log(`\nDone: ${generated} generated, ${skipped} skipped.`);
}

main().catch(console.error);
