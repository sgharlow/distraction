#!/usr/bin/env npx tsx
// ═══════════════════════════════════════════════════════════════
// Process Orphaned Articles
// Clusters and scores unassigned articles from frozen/live weeks
// that were missed when the process pipeline was broken.
//
// Usage:
//   npx tsx scripts/process-orphaned-articles.ts
//   npx tsx scripts/process-orphaned-articles.ts --week 2026-02-22
//   npx tsx scripts/process-orphaned-articles.ts --dry-run
// ═══════════════════════════════════════════════════════════════

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { format } from 'date-fns';
import { classifySource } from '../src/lib/ingestion/classify-source';

// ── Config ──
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY || !ANTHROPIC_KEY) {
  console.error('Missing required environment variables. Check .env.local');
  process.exit(1);
}

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const SONNET_MODEL = 'claude-sonnet-4-5-20250929';

// ── Args ──
const args = process.argv.slice(2);
const getArg = (name: string) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};
const hasFlag = (name: string) => args.includes(`--${name}`);
const DRY_RUN = hasFlag('dry-run');
const TARGET_WEEK = getArg('week');

// ── Clients ──
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: { schema: 'distraction' },
});
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

// ── JSON extraction ──
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*\n([\s\S]+?)\n\s*```/);
  if (fenced) return fenced[1].trim();

  const firstBracket = text.indexOf('[');
  const firstBrace = text.indexOf('{');
  if (firstBracket === -1 && firstBrace === -1) return text.trim();

  const start = firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)
    ? firstBracket : firstBrace;
  const isArray = text[start] === '[';
  const closer = isArray ? ']' : '}';

  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === text[start]) depth++;
    else if (text[i] === closer) depth--;
    if (depth === 0) return text.substring(start, i + 1);
  }
  return text.substring(start);
}

// ── Classify primary_list ──
function classifyPrimaryList(
  result: { a_score?: { final_score?: number }; b_score?: { final_score?: number }; noise_flag?: boolean },
  event: { mechanism_of_harm?: string | null },
): string {
  const a = result.a_score?.final_score ?? 0;
  const b = result.b_score?.final_score ?? 0;
  const D = a - b;
  const mech = event.mechanism_of_harm;
  const isLowMech = !mech || mech === 'norm_erosion_only';

  if (a < 25 && isLowMech && result.noise_flag) return 'C';
  if (a >= 25 && D >= 10) return 'A';
  if (b >= 25 && D <= -10) return 'B';
  if (a >= 25 && b >= 25 && Math.abs(D) < 10) return a >= b ? 'A' : 'B';
  if (a < 25 && b < 25) return 'C';
  return a >= b ? 'A' : 'B';
}

// ── Identify events from articles ──
async function identifyEvents(
  articles: Array<{ headline: string; publisher: string; published_at: string }>,
  existingEventTitles: string[] = [],
) {
  const articleText = articles
    .slice(0, 100)
    .map((a, i) => `[${i}] "${a.headline}" — ${a.publisher} (${a.published_at?.slice(0, 10) || 'unknown'})`)
    .join('\n');

  let contextNote = '';
  if (existingEventTitles.length > 0) {
    contextNote = `\n\nIMPORTANT — Events already tracked this week. Assign articles to existing events if they cover the same action. Only create new events for genuinely distinct events:\n${existingEventTitles.map((t) => `- ${t}`).join('\n')}`;
  }

  const resp = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 8192,
    temperature: 0.2,
    system: `You are a political event classifier for The Distraction Index. Given US political news articles from a specific week, identify 10-25 distinct EVENTS (not articles). Focus on Trump administration actions, DOJ/FBI, congressional responses, executive orders, court rulings, and manufactured distractions. Each event should map to one of: List A (governance damage), List B (distraction/hype), or List C (noise). Respond with ONLY a JSON array, no markdown fences or other text.`,
    messages: [
      {
        role: 'user',
        content: `Identify distinct political events from these articles:\n\n${articleText}${contextNote}\n\nRespond with a raw JSON array (no markdown, no code fences):\n[\n  {\n    "title": "...",\n    "event_date": "YYYY-MM-DD",\n    "summary": "2-3 sentence factual summary",\n    "mechanism_of_harm": "policy_change|enforcement_action|personnel_capture|resource_reallocation|election_admin_change|judicial_legal_action|norm_erosion_only|information_operation|null",\n    "scope": "federal|multi_state|single_state|local|international",\n    "affected_population": "narrow|moderate|broad",\n    "actors": ["..."],\n    "institution": "...",\n    "topic_tags": ["..."],\n    "preliminary_list": "A|B|C",\n    "article_indices": [0, 3],\n    "confidence": 0.85\n  }\n]`,
      },
    ],
  });

  const text = resp.content[0].type === 'text' ? resp.content[0].text : '';
  const tokens = { input: resp.usage.input_tokens, output: resp.usage.output_tokens };
  const json = extractJson(text);
  return { events: JSON.parse(json) as any[], tokens };
}

// ── Score a single event ──
async function scoreEventWithClaude(
  event: { title: string; summary: string; mechanism: string | null; scope: string | null; affected_population: string | null },
  articleHeadlines: string[],
) {
  const articlesText = articleHeadlines.slice(0, 20).map((h, i) => `${i + 1}. ${h}`).join('\n');

  const resp = await anthropic.messages.create({
    model: SONNET_MODEL,
    max_tokens: 4096,
    temperature: 0.2,
    system: `You are the scoring engine for The Distraction Index v2.2. Score this event on BOTH the Constitutional Damage (A) and Distraction/Hype (B) scales. Use the exact formulas: A-score has 7 drivers (election:0.22, rule_of_law:0.18, separation:0.16, civil_rights:0.14, capture:0.14, corruption:0.10, violence:0.06) each 0-5, severity multipliers 0.8-1.3, mechanism/scope modifiers. B-score has Layer 1 hype (55%) and Layer 2 strategic (45% modulated by intentionality 0-15). Classification: D=A-B, List A if A>=25 AND D>=+10, List B if B>=25 AND D<=-10, Mixed if both>=25 AND |D|<10, Noise if A<25+no mechanism+noise indicators. Respond with ONLY raw JSON, no markdown fences.`,
    messages: [
      {
        role: 'user',
        content: `Score this event:\n\nTitle: ${event.title}\nSummary: ${event.summary}\nMechanism: ${event.mechanism || 'unknown'}\nScope: ${event.scope || 'unknown'}\nPopulation: ${event.affected_population || 'unknown'}\n\nArticles:\n${articlesText}\n\nRespond with raw JSON only (no markdown, no code fences):\n{\n  "a_score": { "drivers": { "election":0,"rule_of_law":0,"separation":0,"civil_rights":0,"capture":0,"corruption":0,"violence":0 }, "severity": { "durability":1.0,"reversibility":1.0,"precedent":1.0 }, "mechanism_modifier":1.0, "scope_modifier":1.0, "base_score":0, "final_score":0 },\n  "b_score": { "layer1": { "outrage_bait":0,"meme_ability":0,"novelty":0,"media_friendliness":0 }, "layer2": { "mismatch":0,"timing":0,"narrative_pivot":0,"pattern_match":0 }, "intentionality": { "indicators":[], "total":0 }, "intent_weight":0.10, "final_score":0 },\n  "primary_list":"A",\n  "is_mixed":false,\n  "noise_flag":false,\n  "noise_reason_codes":[],\n  "confidence":0.85,\n  "score_rationale":"...",\n  "action_item":"..."\n}`,
      },
    ],
  });

  const text = resp.content[0].type === 'text' ? resp.content[0].text : '';
  const tokens = { input: resp.usage.input_tokens, output: resp.usage.output_tokens };
  const json = extractJson(text);
  return { result: JSON.parse(json) as any, tokens };
}

// ── Smokescreen pairing ──
async function pairSmokescreensForWeek(weekId: string): Promise<number> {
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('week_id', weekId)
    .not('primary_list', 'is', null);

  if (!events || events.length === 0) return 0;

  const bCandidates = events.filter(
    (e) => e.primary_list === 'B' && e.b_intentionality_score != null && e.b_intentionality_score >= 4,
  );
  const aCandidates = events.filter(
    (e) => e.primary_list === 'A' && e.a_score != null && e.a_score >= 40,
  );

  if (bCandidates.length === 0 || aCandidates.length === 0) return 0;

  const pairs: any[] = [];
  for (const bEvent of bCandidates) {
    for (const aEvent of aCandidates) {
      let timeDelta: number | null = null;
      if (bEvent.event_date && aEvent.event_date) {
        timeDelta = Math.abs(new Date(bEvent.event_date).getTime() - new Date(aEvent.event_date).getTime()) / (1000 * 60 * 60);
      }
      const dispConf = timeDelta != null && timeDelta <= 48 ? 0.5 : 0.3;
      const rawSI = (bEvent.b_score * aEvent.a_score) / 100;
      const si = rawSI * (0.7 + 0.3 * dispConf);
      if (si >= 15) {
        pairs.push({
          week_id: weekId,
          distraction_event_id: bEvent.id,
          damage_event_id: aEvent.id,
          smokescreen_index: Math.round(si * 10) / 10,
          displacement_confidence: dispConf,
          time_delta_hours: timeDelta ? Math.round(timeDelta) : null,
        });
      }
    }
  }

  if (pairs.length === 0) return 0;
  await supabase.from('smokescreen_pairs').delete().eq('week_id', weekId);
  const { error } = await supabase.from('smokescreen_pairs').insert(pairs);
  if (error) console.error(`  Smokescreen insert error: ${error.message}`);
  return pairs.length;
}

// ── Process a single week's orphaned articles ──
async function processWeekArticles(weekId: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing orphaned articles for week: ${weekId}`);
  console.log('='.repeat(60));

  // 1. Check week status
  const { data: week } = await supabase
    .from('weekly_snapshots')
    .select('*')
    .eq('week_id', weekId)
    .single();

  if (!week) {
    console.error(`  Week ${weekId} not found!`);
    return;
  }

  const wasFrozen = week.status === 'frozen';
  console.log(`  Week status: ${week.status}${wasFrozen ? ' (will unfreeze temporarily)' : ''}`);

  // 2. Temporarily unfreeze if needed
  if (wasFrozen && !DRY_RUN) {
    await supabase
      .from('weekly_snapshots')
      .update({ status: 'live', frozen_at: null })
      .eq('week_id', weekId);
    console.log('  Unfroze week temporarily for processing');
  }

  // 3. Get unassigned articles
  const { data: unassigned, count } = await supabase
    .from('articles')
    .select('id, url, headline, publisher, published_at, ingestion_source', { count: 'exact' })
    .eq('week_id', weekId)
    .is('event_id', null);

  const articles = unassigned || [];
  console.log(`  Found ${articles.length} unassigned articles (of ${count} total)`);

  if (articles.length === 0) {
    console.log('  No orphaned articles to process');
    if (wasFrozen && !DRY_RUN) {
      await supabase.from('weekly_snapshots').update({ status: 'frozen', frozen_at: new Date().toISOString() }).eq('week_id', weekId);
    }
    return;
  }

  if (DRY_RUN) {
    console.log('  [DRY RUN] Would cluster and score articles');
    return;
  }

  // 4. Get existing events for context
  const { data: existingEvents } = await supabase
    .from('events')
    .select('id, title')
    .eq('week_id', weekId);
  const existingEventTitles = (existingEvents || []).map((e) => e.title);
  console.log(`  Existing events in week: ${existingEventTitles.length}`);

  // 5. Process in batches of 100 articles
  const BATCH_SIZE = 100;
  let totalEventsCreated = 0;
  let totalEventsScored = 0;
  let totalTokens = { input: 0, output: 0 };

  for (let batchStart = 0; batchStart < articles.length; batchStart += BATCH_SIZE) {
    const batch = articles.slice(batchStart, batchStart + BATCH_SIZE);
    const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(articles.length / BATCH_SIZE);
    console.log(`\n  --- Batch ${batchNum}/${totalBatches} (${batch.length} articles) ---`);

    // 5a. Cluster articles into events
    console.log('  Identifying events (Haiku)...');
    let identifiedEvents: any[];
    try {
      const { events, tokens } = await identifyEvents(
        batch.map((a) => ({
          headline: a.headline,
          publisher: a.publisher || 'unknown',
          published_at: a.published_at,
        })),
        existingEventTitles,
      );
      identifiedEvents = events;
      totalTokens.input += tokens.input;
      totalTokens.output += tokens.output;
      console.log(`  Identified ${events.length} events (${tokens.input + tokens.output} tokens)`);
    } catch (err) {
      console.error(`  Event identification failed: ${err}`);
      continue;
    }

    // 5b. Create and score each event
    for (const event of identifiedEvents) {
      try {
        // Check if title already exists
        const isDuplicate = existingEventTitles.some((t) => {
          const tTokens = new Set(t.toLowerCase().split(/\s+/));
          const eTokens = new Set(event.title.toLowerCase().split(/\s+/));
          const intersection = [...tTokens].filter((x) => eTokens.has(x));
          return intersection.length / Math.max(tTokens.size, eTokens.size) >= 0.65;
        });
        if (isDuplicate) {
          console.log(`  Skipping duplicate: "${event.title}"`);
          continue;
        }

        const eventArticleIndices = (event.article_indices || []).filter((i: number) => i < batch.length);
        const eventArticleHeadlines = eventArticleIndices.map((i: number) => batch[i].headline);

        console.log(`  Scoring: "${event.title}" (${eventArticleHeadlines.length} articles)...`);

        const { result, tokens } = await scoreEventWithClaude(
          {
            title: event.title,
            summary: event.summary,
            mechanism: event.mechanism_of_harm,
            scope: event.scope,
            affected_population: event.affected_population,
          },
          eventArticleHeadlines,
        );
        totalTokens.input += tokens.input;
        totalTokens.output += tokens.output;

        // Insert event
        const { data: insertedEvent, error: insertError } = await supabase
          .from('events')
          .insert({
            week_id: weekId,
            title: event.title,
            event_date: event.event_date || weekId,
            summary: event.summary,
            mechanism_of_harm: event.mechanism_of_harm,
            scope: event.scope,
            affected_population: event.affected_population,
            actors: event.actors || [],
            institution: event.institution,
            topic_tags: event.topic_tags || [],
            a_score: result.a_score?.final_score,
            a_components: result.a_score,
            a_severity_multiplier: result.a_score?.severity
              ? (result.a_score.severity.durability + result.a_score.severity.reversibility + result.a_score.severity.precedent) / 3
              : 1.0,
            b_score: result.b_score?.final_score,
            b_layer1_hype: result.b_score?.layer1,
            b_layer2_distraction: result.b_score?.layer2,
            b_intentionality_score: result.b_score?.intentionality?.total,
            primary_list: classifyPrimaryList(result, event),
            is_mixed: result.is_mixed || false,
            noise_flag: result.noise_flag || false,
            noise_reason_codes: result.noise_reason_codes || [],
            confidence: result.confidence || event.confidence,
            score_rationale: result.score_rationale,
            action_item: result.action_item,
            article_count: eventArticleHeadlines.length,
            score_frozen: wasFrozen,
            frozen_at: wasFrozen ? new Date().toISOString() : null,
            frozen_by: wasFrozen ? 'system:backfill' : null,
            human_reviewed: false,
          })
          .select('id')
          .single();

        if (insertError) {
          console.error(`    Insert error: ${insertError.message}`);
          continue;
        }

        totalEventsCreated++;
        totalEventsScored++;
        existingEventTitles.push(event.title); // Add to context for next batch

        const aScore = result.a_score?.final_score?.toFixed(1) || '?';
        const bScore = result.b_score?.final_score?.toFixed(1) || '?';
        const list = classifyPrimaryList(result, event);
        console.log(`    → A:${aScore} B:${bScore} List:${list}${result.is_mixed ? ' (MIXED)' : ''}`);

        // Link articles to event
        if (insertedEvent?.id) {
          const articleIds = eventArticleIndices
            .map((i: number) => batch[i].id)
            .filter(Boolean);
          if (articleIds.length > 0) {
            await supabase
              .from('articles')
              .update({ event_id: insertedEvent.id })
              .in('id', articleIds);
          }
        }

        // Log score change
        if (insertedEvent?.id) {
          await supabase.from('score_changes').insert({
            event_id: insertedEvent.id,
            week_id: weekId,
            changed_by: 'system:backfill',
            change_type: 'initial',
            new_a_score: result.a_score?.final_score,
            new_b_score: result.b_score?.final_score,
            new_list: list,
            reason: 'Backfill processing of orphaned articles',
            version_after: 1,
            llm_response: result,
          });
        }

        // Rate limiting
        await new Promise((r) => setTimeout(r, 1000));
      } catch (err) {
        console.error(`    Scoring failed for "${event.title}": ${err}`);
      }
    }
  }

  // 6. Run smokescreen pairing
  console.log('\n  Running smokescreen pairing...');
  const pairsCount = await pairSmokescreensForWeek(weekId);
  console.log(`  Found ${pairsCount} smokescreen pairs`);

  // 7. Recompute week stats
  await supabase.rpc('compute_week_stats', { target_week_id: weekId });

  // 8. Refreeze if was frozen
  if (wasFrozen) {
    await supabase
      .from('weekly_snapshots')
      .update({ status: 'frozen', frozen_at: new Date().toISOString() })
      .eq('week_id', weekId);
    console.log('  Re-froze week');
  }

  // 9. Log pipeline run
  await supabase.from('pipeline_runs').insert({
    run_type: 'backfill',
    status: 'completed',
    completed_at: new Date().toISOString(),
    articles_fetched: 0,
    articles_new: articles.length,
    events_created: totalEventsCreated,
    events_scored: totalEventsScored,
    metadata: {
      week_id: weekId,
      backfill_type: 'orphaned_articles',
      smokescreen_pairs: pairsCount,
      tokens: totalTokens,
    },
  });

  console.log(`\n  ✓ Week ${weekId} complete:`);
  console.log(`    Events created: ${totalEventsCreated}`);
  console.log(`    Events scored: ${totalEventsScored}`);
  console.log(`    Smokescreen pairs: ${pairsCount}`);
  console.log(`    Tokens: ${(totalTokens.input + totalTokens.output).toLocaleString()}`);
}

// ── Main ──
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   Process Orphaned Articles — Backfill                   ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);

  if (TARGET_WEEK) {
    // Process single week
    await processWeekArticles(TARGET_WEEK);
  } else {
    // Find all weeks with unassigned articles
    console.log('\nFinding weeks with orphaned articles...');

    const { data: weeks } = await supabase
      .from('weekly_snapshots')
      .select('week_id, status, total_events')
      .order('week_start', { ascending: false });

    for (const week of weeks || []) {
      const { count } = await supabase
        .from('articles')
        .select('id', { count: 'exact', head: true })
        .eq('week_id', week.week_id)
        .is('event_id', null);

      if (count && count > 10) {
        console.log(`  ${week.week_id}: ${count} orphaned articles (${week.total_events} events, ${week.status})`);
      }
    }

    // Process weeks with significant orphaned articles
    for (const week of weeks || []) {
      const { count } = await supabase
        .from('articles')
        .select('id', { count: 'exact', head: true })
        .eq('week_id', week.week_id)
        .is('event_id', null);

      if (count && count > 10) {
        await processWeekArticles(week.week_id);
      }
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('BACKFILL COMPLETE');
  console.log('═'.repeat(60));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
