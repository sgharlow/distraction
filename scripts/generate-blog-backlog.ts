/**
 * Generate blog posts for all frozen weeks that don't have one yet.
 *
 * Usage:
 *   npx tsx scripts/generate-blog-backlog.ts              # Generate all missing
 *   npx tsx scripts/generate-blog-backlog.ts --dry-run     # Preview without writing
 *   npx tsx scripts/generate-blog-backlog.ts --week 2026-03-08  # Generate for one week
 */
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env.local') });

import Anthropic from '@anthropic-ai/sdk';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

// Lightweight Supabase fetch wrapper (avoids importing server-only code)
async function supabaseQuery(table: string, params: string = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Profile': 'distraction',
      'Accept-Profile': 'distraction',
    },
  });
  return res.json();
}

async function supabaseInsert(table: string, data: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Profile': 'distraction',
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Insert failed: ${res.status} ${err}`);
  }
  return res.json();
}

function getWeekNumber(weekId: string): number {
  const firstWeek = new Date('2024-12-29');
  const thisWeek = new Date(weekId);
  return Math.round((thisWeek.getTime() - firstWeek.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
}

const SYSTEM_PROMPT = `You are a civic intelligence analyst writing for The Distraction Index — a weekly report that scores U.S. political events on two axes: constitutional damage (A-score) and distraction/hype (B-score).

Write an engaging, factual blog post analyzing this week's data. Your audience is politically engaged citizens who want to understand what's actually happening vs. what's dominating headlines.

Respond with JSON only:
{
  "title": "Compelling headline with the week's most striking finding",
  "meta_description": "150 char SEO description",
  "body_markdown": "800-1200 word markdown article with ## headers",
  "keywords": ["5-8 relevant SEO keywords"]
}

Guidelines:
- Lead with the most striking data point (highest damage score, biggest smokescreen gap)
- Use specific numbers and event names
- Explain what the scores mean for democracy in plain language
- End with a link to the full interactive report
- No partisan language — let the data speak
- Use ## for section headers, **bold** for emphasis, bullet lists for data`;

async function generatePost(weekData: {
  weekId: string;
  weekNumber: number;
  totalEvents: number;
  listA: Array<{ title: string; a_score: number; b_score: number }>;
  listB: Array<{ title: string; a_score: number; b_score: number }>;
  smokescreenCount: number;
  avgDamage: number;
  avgDistraction: number;
}) {
  const client = new Anthropic({ apiKey: ANTHROPIC_KEY });

  const userPrompt = `Generate a blog post for Week ${weekData.weekNumber} (${weekData.weekId}).

Data summary:
- ${weekData.totalEvents} events scored
- ${weekData.listA.length} high-damage events (List A)
- ${weekData.listB.length} high-distraction events (List B)
- ${weekData.smokescreenCount} smokescreen pairs detected
- Average damage: ${weekData.avgDamage.toFixed(1)}/100
- Average distraction: ${weekData.avgDistraction.toFixed(1)}/100

Top damage events:
${weekData.listA.slice(0, 5).map(e => `- "${e.title}" — Damage: ${e.a_score.toFixed(1)}, Distraction: ${e.b_score.toFixed(1)}`).join('\n')}

Top distraction events:
${weekData.listB.slice(0, 5).map(e => `- "${e.title}" — Distraction: ${e.b_score.toFixed(1)}, Damage: ${e.a_score.toFixed(1)}`).join('\n')}

Full report URL: https://distractionindex.org/week/${weekData.weekId}`;

  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 2048,
    temperature: 0.3,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : text.trim();
  const parsed = JSON.parse(jsonStr);
  const tokens = response.usage.input_tokens + response.usage.output_tokens;

  return { ...parsed, tokens, model: HAIKU_MODEL };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const singleWeek = args.includes('--week') ? args[args.indexOf('--week') + 1] : null;

  console.log('Fetching frozen weeks...');

  // Get frozen weeks
  let weeksParams = 'status=eq.frozen&order=week_id.asc';
  if (singleWeek) weeksParams += `&week_id=eq.${singleWeek}`;
  const weeks = await supabaseQuery('weekly_snapshots', weeksParams);

  if (!weeks?.length) {
    console.log('No frozen weeks found.');
    return;
  }

  // Get existing blog posts
  const existingPosts = await supabaseQuery('blog_posts', 'select=week_id');
  const existingWeekIds = new Set((existingPosts ?? []).map((p: any) => p.week_id));

  const missing = weeks.filter((w: any) => !existingWeekIds.has(w.week_id));
  console.log(`Found ${weeks.length} frozen weeks, ${missing.length} need blog posts.\n`);

  if (missing.length === 0) {
    console.log('All frozen weeks have blog posts.');
    return;
  }

  let generated = 0;
  let failed = 0;
  let totalTokens = 0;

  for (const week of missing) {
    const weekNum = getWeekNumber(week.week_id);

    try {
      // Fetch events for this week
      const events = await supabaseQuery('events',
        `week_id=eq.${week.week_id}&primary_list=not.is.null&order=a_score.desc.nullslast`);

      const pairs = await supabaseQuery('smokescreen_pairs',
        `week_id=eq.${week.week_id}&select=id`);

      const allEvents = events ?? [];
      const listA = allEvents
        .filter((e: any) => e.primary_list === 'A')
        .sort((a: any, b: any) => (b.a_score || 0) - (a.a_score || 0));
      const listB = allEvents
        .filter((e: any) => e.primary_list === 'B')
        .sort((a: any, b: any) => (b.b_score || 0) - (a.b_score || 0));

      const avgDamage = allEvents.length > 0
        ? allEvents.reduce((s: number, e: any) => s + (e.a_score || 0), 0) / allEvents.length
        : 0;
      const avgDistraction = allEvents.length > 0
        ? allEvents.reduce((s: number, e: any) => s + (e.b_score || 0), 0) / allEvents.length
        : 0;

      if (allEvents.length === 0) {
        console.log(`  SKIP Week ${weekNum} (${week.week_id}) — no events`);
        continue;
      }

      console.log(`  Generating Week ${weekNum} (${week.week_id}) — ${allEvents.length} events...`);

      if (dryRun) {
        console.log(`    [DRY RUN] Would generate blog post`);
        generated++;
        continue;
      }

      const result = await generatePost({
        weekId: week.week_id,
        weekNumber: weekNum,
        totalEvents: allEvents.length,
        listA: listA.map((e: any) => ({ title: e.title, a_score: e.a_score || 0, b_score: e.b_score || 0 })),
        listB: listB.map((e: any) => ({ title: e.title, a_score: e.a_score || 0, b_score: e.b_score || 0 })),
        smokescreenCount: pairs?.length ?? 0,
        avgDamage,
        avgDistraction,
      });

      const slug = `week-${weekNum}-${week.week_id}`;
      const wordCount = result.body_markdown.split(/\s+/).length;

      await supabaseInsert('blog_posts', {
        slug,
        title: result.title,
        meta_description: result.meta_description,
        body_markdown: result.body_markdown,
        week_id: week.week_id,
        keywords: result.keywords,
        word_count: wordCount,
        generation_model: result.model,
        generation_tokens: result.tokens,
        published_at: new Date(week.week_id + 'T12:00:00Z').toISOString(),
      });

      console.log(`    OK — "${result.title}" (${wordCount} words, ${result.tokens} tokens)`);
      generated++;
      totalTokens += result.tokens;

      // Rate limit
      await new Promise((r) => setTimeout(r, 300));
    } catch (err: any) {
      console.log(`    ERROR Week ${weekNum}: ${err.message.substring(0, 100)}`);
      failed++;
    }
  }

  console.log(`\n=== COMPLETE ===`);
  console.log(`Generated: ${generated}, Failed: ${failed}, Total tokens: ${totalTokens}`);
  if (dryRun) console.log('(DRY RUN — nothing was written to database)');
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
