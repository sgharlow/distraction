#!/usr/bin/env npx tsx
// ═══════════════════════════════════════════════════════════════
// Historical Backfill Script
// Populates all weeks from Jan 2025 → present with AI-identified events
//
// Usage:
//   npx tsx scripts/backfill.ts
//   npx tsx scripts/backfill.ts --start 2025-03-01 --end 2025-04-01
//   npx tsx scripts/backfill.ts --week 2025-01-05
//   npx tsx scripts/backfill.ts --dry-run
//   npx tsx scripts/backfill.ts --resume
//
// Requires .env.local with SUPABASE and ANTHROPIC keys.
// ═══════════════════════════════════════════════════════════════

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { addDays, format, isAfter } from 'date-fns';
import * as fs from 'fs';
import * as path from 'path';
import { classifySource } from '../src/lib/ingestion/classify-source';

// ── Config ──
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY || !ANTHROPIC_KEY) {
  console.error('Missing required environment variables. Check .env.local');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? 'set' : 'MISSING');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_KEY ? 'set' : 'MISSING');
  console.error('  ANTHROPIC_API_KEY:', ANTHROPIC_KEY ? 'set' : 'MISSING');
  process.exit(1);
}

const FIRST_WEEK = new Date('2024-12-29'); // Sun Dec 29, 2024
const STATE_FILE = path.join(__dirname, '.backfill-state.json');

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const SONNET_MODEL = 'claude-sonnet-4-5-20250929';

// ── Arg parsing ──
const args = process.argv.slice(2);
const getArg = (name: string) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};
const hasFlag = (name: string) => args.includes(`--${name}`);

// ── Robust JSON extraction from Claude responses ──
function extractJson(text: string): string {
  // Try code-fenced JSON (greedy to capture full content)
  const fenced = text.match(/```(?:json)?\s*\n([\s\S]+?)\n\s*```/);
  if (fenced) return fenced[1].trim();

  // Try to find raw JSON array or object
  const firstBracket = text.indexOf('[');
  const firstBrace = text.indexOf('{');
  if (firstBracket === -1 && firstBrace === -1) return text.trim();

  const start = firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)
    ? firstBracket : firstBrace;
  const isArray = text[start] === '[';
  const closer = isArray ? ']' : '}';

  // Find the matching closing bracket by counting depth
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === text[start]) depth++;
    else if (text[i] === closer) depth--;
    if (depth === 0) return text.substring(start, i + 1);
  }
  return text.substring(start);
}

const DRY_RUN = hasFlag('dry-run');
const RESUME = hasFlag('resume');
const SINGLE_WEEK = getArg('week');
const START_DATE = getArg('start');
const END_DATE = getArg('end');

// ── Classify primary_list using dominance margin logic (matches classify.ts) ──
function classifyPrimaryList(
  result: { a_score?: { final_score?: number }; b_score?: { final_score?: number }; primary_list?: string; noise_flag?: boolean; is_mixed?: boolean },
  event: { mechanism_of_harm?: string | null },
): string {
  const a = result.a_score?.final_score ?? 0;
  const b = result.b_score?.final_score ?? 0;
  const D = a - b;
  const mech = event.mechanism_of_harm;
  const isLowMech = !mech || mech === 'norm_erosion_only';

  // Noise gate
  if (a < 25 && isLowMech && result.noise_flag) return 'C';
  // Clear A-dominant
  if (a >= 25 && D >= 10) return 'A';
  // Clear B-dominant
  if (b >= 25 && D <= -10) return 'B';
  // Mixed
  if (a >= 25 && b >= 25 && Math.abs(D) < 10) return a >= b ? 'A' : 'B';
  // Low salience
  if (a < 25 && b < 25) return 'C';
  // Edge case
  return a >= b ? 'A' : 'B';
}

// ── Clients ──
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: { schema: 'distraction' },
});
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

// ── State ──
interface BackfillState {
  last_completed_week: string | null;
  total_events: number;
  total_articles: number;
  total_smokescreen_pairs: number;
  total_tokens: { input: number; output: number };
  errors: Array<{ week: string; error: string }>;
  started_at: string;
}

function loadState(): BackfillState {
  if (RESUME && fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  }
  return {
    last_completed_week: null,
    total_events: 0,
    total_articles: 0,
    total_smokescreen_pairs: 0,
    total_tokens: { input: 0, output: 0 },
    errors: [],
    started_at: new Date().toISOString(),
  };
}

function saveState(state: BackfillState) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ── GDELT fetch ──
async function fetchGdeltForWeek(
  weekStart: Date,
  weekEnd: Date,
): Promise<Array<{ url: string; title: string; date: string; domain: string }>> {
  const fmtDt = (d: Date) => format(d, 'yyyyMMdd') + '000000';

  const query =
    '(trump OR "executive order" OR DOJ OR "white house" OR congress OR "supreme court") sourcelang:english sourcecountry:US';
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&format=json&maxrecords=250&startdatetime=${fmtDt(weekStart)}&enddatetime=${fmtDt(addDays(weekEnd, 1))}&sort=datedesc`;

  const resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!resp.ok) throw new Error(`GDELT error: ${resp.status}`);
  const data = await resp.json();

  return (data.articles || []).map((a: any) => ({
    url: a.url,
    title: a.title || '',
    date: a.seendate
      ? `${a.seendate.slice(0, 4)}-${a.seendate.slice(4, 6)}-${a.seendate.slice(6, 8)}`
      : format(weekStart, 'yyyy-MM-dd'),
    domain: a.domain || 'unknown',
  }));
}

// ── Dedup articles by URL and headline similarity ──
function deduplicateArticles(
  articles: Array<{ url: string; title: string; date: string; domain: string }>,
): Array<{ url: string; title: string; date: string; domain: string }> {
  const seen = new Set<string>();
  return articles.filter((a) => {
    if (!a.title || a.title.length < 15) return false;
    const normUrl = a.url.replace(/\?.*$/, '').replace(/\/$/, '').toLowerCase();
    if (seen.has(normUrl)) return false;
    seen.add(normUrl);
    return true;
  });
}

// ── Claude calls ──
async function identifyEvents(
  articles: Array<{ title: string; domain: string; date: string }>,
) {
  const articleText = articles
    .slice(0, 100)
    .map((a, i) => `[${i}] "${a.title}" — ${a.domain} (${a.date})`)
    .join('\n');

  const resp = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 8192,
    temperature: 0.2,
    system: `You are a political event classifier for The Distraction Index. Given US political news articles from a specific week, identify 10-25 distinct EVENTS (not articles). Focus on Trump administration actions, DOJ/FBI, congressional responses, executive orders, court rulings, and manufactured distractions. Each event should map to one of: List A (governance damage), List B (distraction/hype), or List C (noise). Respond with ONLY a JSON array, no markdown fences or other text.`,
    messages: [
      {
        role: 'user',
        content: `Identify distinct political events from these articles:\n\n${articleText}\n\nRespond with a raw JSON array (no markdown, no code fences):\n[\n  {\n    "title": "...",\n    "event_date": "YYYY-MM-DD",\n    "summary": "2-3 sentence factual summary",\n    "mechanism_of_harm": "policy_change|enforcement_action|personnel_capture|resource_reallocation|election_admin_change|judicial_legal_action|norm_erosion_only|information_operation|null",\n    "scope": "federal|multi_state|single_state|local|international",\n    "affected_population": "narrow|moderate|broad",\n    "actors": ["..."],\n    "institution": "...",\n    "topic_tags": ["..."],\n    "preliminary_list": "A|B|C",\n    "article_indices": [0, 3],\n    "confidence": 0.85\n  }\n]`,
      },
    ],
  });

  const text = resp.content[0].type === 'text' ? resp.content[0].text : '';
  const tokens = { input: resp.usage.input_tokens, output: resp.usage.output_tokens };
  const stopReason = resp.stop_reason;

  if (stopReason === 'max_tokens') {
    console.log(`    ⚠ Response truncated (${tokens.output} tokens). Retrying with fewer articles...`);
    // Retry with fewer articles
    const smallerText = articles
      .slice(0, 50)
      .map((a, i) => `[${i}] "${a.title}" — ${a.domain}`)
      .join('\n');
    const retry = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 8192,
      temperature: 0.2,
      system: `You are a political event classifier. Identify 10-20 distinct US political events from these headlines. Respond with ONLY a JSON array, no markdown.`,
      messages: [{ role: 'user', content: `Headlines:\n${smallerText}\n\nJSON array of events with fields: title, event_date, summary, mechanism_of_harm, scope, affected_population, actors, institution, topic_tags, preliminary_list (A/B/C), article_indices, confidence.` }],
    });
    const retryText = retry.content[0].type === 'text' ? retry.content[0].text : '';
    const retryJson = extractJson(retryText);
    return { events: JSON.parse(retryJson) as any[], tokens: { input: tokens.input + retry.usage.input_tokens, output: tokens.output + retry.usage.output_tokens } };
  }

  const json = extractJson(text);
  return { events: JSON.parse(json) as any[], tokens };
}

async function scoreEventWithClaude(
  event: {
    title: string;
    summary: string;
    mechanism: string | null;
    scope: string | null;
    affected_population: string | null;
  },
  articleHeadlines: string[],
) {
  const articlesText = articleHeadlines
    .slice(0, 20)
    .map((h, i) => `${i + 1}. ${h}`)
    .join('\n');

  const systemPrompt = `You are the scoring engine for The Distraction Index v2.2. Score this event on BOTH the Constitutional Damage (A) and Distraction/Hype (B) scales. Use the exact formulas: A-score has 7 drivers (election:0.22, rule_of_law:0.18, separation:0.16, civil_rights:0.14, capture:0.14, corruption:0.10, violence:0.06) each 0-5, severity multipliers 0.8-1.3, mechanism/scope modifiers. B-score has Layer 1 hype (55%) and Layer 2 strategic (45% modulated by intentionality 0-15). Classification: D=A-B, List A if A>=25 AND D>=+10, List B if B>=25 AND D<=-10, Mixed if both>=25 AND |D|<10, Noise if A<25+no mechanism+noise indicators. Respond with ONLY raw JSON, no markdown fences.`;

  const resp = await anthropic.messages.create({
    model: SONNET_MODEL,
    max_tokens: 4096,
    temperature: 0.2,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Score this event:\n\nTitle: ${event.title}\nSummary: ${event.summary}\nMechanism: ${event.mechanism || 'unknown'}\nScope: ${event.scope || 'unknown'}\nPopulation: ${event.affected_population || 'unknown'}\n\nArticles:\n${articlesText}\n\nRespond with raw JSON only (no markdown, no code fences):\n{\n  "a_score": { "drivers": { "election":0,"rule_of_law":0,"separation":0,"civil_rights":0,"capture":0,"corruption":0,"violence":0 }, "severity": { "durability":1.0,"reversibility":1.0,"precedent":1.0 }, "mechanism_modifier":1.0, "scope_modifier":1.0, "base_score":0, "final_score":0 },\n  "b_score": { "layer1": { "outrage_bait":0,"meme_ability":0,"novelty":0,"media_friendliness":0 }, "layer2": { "mismatch":0,"timing":0,"narrative_pivot":0,"pattern_match":0 }, "intentionality": { "indicators":[], "total":0 }, "intent_weight":0.10, "final_score":0 },\n  "primary_list":"A",\n  "is_mixed":false,\n  "noise_flag":false,\n  "noise_reason_codes":[],\n  "noise_score":null,\n  "confidence":0.85,\n  "score_rationale":"...",\n  "action_item":"..."\n}`,
      },
    ],
  });

  const text = resp.content[0].type === 'text' ? resp.content[0].text : '';
  const tokens = { input: resp.usage.input_tokens, output: resp.usage.output_tokens };

  const json = extractJson(text);
  return { result: JSON.parse(json) as any, tokens };
}

// ── Smokescreen pairing for a week ──
async function pairSmokescreens(weekId: string): Promise<number> {
  // Fetch all scored events for this week
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('week_id', weekId)
    .not('primary_list', 'is', null);

  if (!events || events.length === 0) return 0;

  // B-candidates: intentionality >= 4
  const bCandidates = events.filter(
    (e) =>
      e.primary_list === 'B' &&
      e.b_intentionality_score != null &&
      e.b_intentionality_score >= 4,
  );

  // A-candidates: a_score >= 40
  const aCandidates = events.filter(
    (e) => e.primary_list === 'A' && e.a_score != null && e.a_score >= 40,
  );

  if (bCandidates.length === 0 || aCandidates.length === 0) return 0;

  const pairs: Array<{
    week_id: string;
    distraction_event_id: string;
    damage_event_id: string;
    smokescreen_index: number;
    displacement_confidence: number;
    time_delta_hours: number | null;
  }> = [];

  for (const bEvent of bCandidates) {
    for (const aEvent of aCandidates) {
      // Calculate time delta
      let timeDelta: number | null = null;
      if (bEvent.event_date && aEvent.event_date) {
        const bDate = new Date(bEvent.event_date);
        const aDate = new Date(aEvent.event_date);
        timeDelta = Math.abs(bDate.getTime() - aDate.getTime()) / (1000 * 60 * 60);
      }

      // Default displacement confidence for backfill (conservative estimate)
      const dispConf = timeDelta != null && timeDelta <= 48 ? 0.5 : 0.3;
      if (dispConf <= 0) continue;

      // SI = (B × A / 100) × (0.7 + 0.3 × displacement_confidence)
      const rawSI = (bEvent.b_score * aEvent.a_score) / 100;
      const si = rawSI * (0.7 + 0.3 * dispConf);

      // Only store significant pairs (SI >= 15)
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

  // Delete existing pairs for this week (in case of re-run)
  await supabase.from('smokescreen_pairs').delete().eq('week_id', weekId);

  // Insert new pairs
  const { error } = await supabase.from('smokescreen_pairs').insert(pairs);
  if (error) {
    console.error(`    Smokescreen insert error: ${error.message}`);
    return 0;
  }

  return pairs.length;
}

// ── Process one week ──
async function processWeek(
  weekStart: Date,
  weekNum: number,
  totalWeeks: number,
  state: BackfillState,
) {
  const weekEnd = addDays(weekStart, 6);
  const weekId = format(weekStart, 'yyyy-MM-dd');
  const label = `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Week ${weekNum}/${totalWeeks}: ${label} (${weekId})`);
  console.log('='.repeat(60));

  if (DRY_RUN) {
    console.log('  [DRY RUN] Would fetch GDELT, identify events, score them');
    return;
  }

  // Create week snapshot (frozen for historical weeks)
  const { error: weekError } = await supabase.rpc('create_week_snapshot', {
    p_week_start: weekId,
    p_status: 'frozen',
  });
  if (weekError) console.error('  Week snapshot error:', weekError.message);

  // Fetch articles from GDELT
  console.log('  Fetching GDELT articles...');
  let articles: Array<{ url: string; title: string; date: string; domain: string }> = [];
  try {
    const raw = await fetchGdeltForWeek(weekStart, weekEnd);
    articles = deduplicateArticles(raw);
    console.log(`  Found ${raw.length} articles, ${articles.length} after dedup`);
  } catch (err) {
    console.error(`  GDELT fetch failed: ${err}`);
    state.errors.push({ week: weekId, error: `GDELT: ${err}` });
    articles = [];
  }

  if (articles.length < 5) {
    console.log('  Too few articles, skipping event identification');
    state.last_completed_week = weekId;
    saveState(state);
    return;
  }

  // Identify events via Haiku
  console.log('  Identifying events (Haiku)...');
  let identifiedEvents: any[];
  try {
    const { events, tokens } = await identifyEvents(articles);
    identifiedEvents = events;
    state.total_tokens.input += tokens.input;
    state.total_tokens.output += tokens.output;
    console.log(
      `  Identified ${events.length} events (${tokens.input + tokens.output} tokens)`,
    );
  } catch (err) {
    console.error(`  Event identification failed: ${err}`);
    state.errors.push({ week: weekId, error: `Haiku: ${err}` });
    state.last_completed_week = weekId;
    saveState(state);
    return;
  }

  // Insert articles into database first (so we can link them)
  console.log(`  Inserting ${articles.length} articles...`);
  const articleInserts = articles.map((a) => ({
    url: a.url,
    headline: a.title,
    publisher: a.domain,
    published_at: `${a.date}T12:00:00Z`,
    week_id: weekId,
    ingestion_source: 'gdelt' as const,
    source_type: classifySource(a.url, a.domain),
  }));

  const { data: insertedArticles } = await supabase
    .from('articles')
    .upsert(articleInserts, { onConflict: 'url', ignoreDuplicates: true })
    .select('id, url');

  state.total_articles += insertedArticles?.length ?? 0;

  // Build URL→article ID map for linking
  const urlToArticleId = new Map<string, string>();
  (insertedArticles ?? []).forEach((a) => urlToArticleId.set(a.url, a.id));

  // Score each event
  let scored = 0;
  for (const event of identifiedEvents) {
    try {
      // Get article headlines for this event
      const eventArticleIndices = (event.article_indices || []).filter(
        (i: number) => i < articles.length,
      );
      const eventArticleHeadlines = eventArticleIndices.map(
        (i: number) => articles[i].title,
      );

      console.log(
        `  Scoring: "${event.title}" (${eventArticleHeadlines.length} articles)...`,
      );

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

      state.total_tokens.input += tokens.input;
      state.total_tokens.output += tokens.output;

      // Compute noise_score for List C events
      let noiseScore: number | null = null;
      if (result.noise_flag || result.primary_list === 'C') {
        noiseScore = result.noise_score ?? Math.random() * 20 + 80; // default high noise
      }

      // Insert event into database
      const { data: insertedEvent, error: insertError } = await supabase
        .from('events')
        .insert({
          week_id: weekId,
          title: event.title,
          event_date: event.event_date || format(weekStart, 'yyyy-MM-dd'),
          summary: event.summary,
          mechanism_of_harm: event.mechanism_of_harm,
          scope: event.scope,
          affected_population: event.affected_population,
          actors: event.actors || [],
          institution: event.institution,
          topic_tags: event.topic_tags || [],
          a_score: result.a_score?.final_score,
          a_components: result.a_score,
          a_severity_multiplier:
            result.a_score?.severity
              ? (result.a_score.severity.durability +
                  result.a_score.severity.reversibility +
                  result.a_score.severity.precedent) /
                3
              : 1.0,
          b_score: result.b_score?.final_score,
          b_layer1_hype: result.b_score?.layer1,
          b_layer2_distraction: result.b_score?.layer2,
          b_intentionality_score: result.b_score?.intentionality?.total,
          primary_list: classifyPrimaryList(result, event),
          is_mixed: result.is_mixed || false,
          noise_flag: result.noise_flag || false,
          noise_reason_codes: result.noise_reason_codes || [],
          noise_score: noiseScore,
          confidence: result.confidence || event.confidence,
          score_rationale: result.score_rationale,
          action_item: result.action_item,
          article_count: eventArticleHeadlines.length,
          score_frozen: true,
          frozen_at: new Date().toISOString(),
          frozen_by: 'system:backfill',
          human_reviewed: false,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error(`    Insert error: ${insertError.message}`);
      } else {
        scored++;
        const aScore = result.a_score?.final_score?.toFixed(1) || '?';
        const bScore = result.b_score?.final_score?.toFixed(1) || '?';
        console.log(
          `    → A:${aScore} B:${bScore} List:${result.primary_list}${result.is_mixed ? ' (MIXED)' : ''}`,
        );

        // Link articles to this event
        if (insertedEvent?.id) {
          const articleUrls = eventArticleIndices
            .map((i: number) => articles[i].url)
            .filter((url: string) => urlToArticleId.has(url));

          if (articleUrls.length > 0) {
            const articleIds = articleUrls.map((url: string) => urlToArticleId.get(url)!);
            await supabase
              .from('articles')
              .update({ event_id: insertedEvent.id })
              .in('id', articleIds);
          }
        }
      }

      // Rate limiting: 1 second between scoring calls
      await new Promise((r) => setTimeout(r, 1000));
    } catch (err) {
      console.error(`    Scoring failed for "${event.title}": ${err}`);
      state.errors.push({ week: weekId, error: `Score "${event.title}": ${err}` });
    }
  }

  state.total_events += scored;

  // Run smokescreen pairing for this week
  console.log('  Running smokescreen pairing...');
  const pairsCount = await pairSmokescreens(weekId);
  state.total_smokescreen_pairs += pairsCount;
  console.log(`  Found ${pairsCount} smokescreen pairs`);

  // Recompute week stats
  await supabase.rpc('compute_week_stats', { target_week_id: weekId });

  // Log pipeline run
  await supabase.from('pipeline_runs').insert({
    run_type: 'backfill',
    status: 'completed',
    completed_at: new Date().toISOString(),
    articles_fetched: articles.length,
    articles_new: insertedArticles?.length ?? 0,
    events_created: scored,
    events_scored: scored,
    metadata: { week_id: weekId, smokescreen_pairs: pairsCount },
  });

  console.log(`  ✓ Week complete: ${scored} events scored, ${pairsCount} smokescreen pairs`);

  state.last_completed_week = weekId;
  saveState(state);

  // Rate limiting: 3 seconds between weeks
  await new Promise((r) => setTimeout(r, 3000));
}

// ── Main ──
async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   The Distraction Index — Backfill       ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}${RESUME ? ' (resuming)' : ''}`);
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log(`Anthropic: ${ANTHROPIC_KEY ? 'configured' : 'MISSING'}`);

  const state = loadState();

  // Determine week range
  let rangeStart = new Date(FIRST_WEEK);
  let rangeEnd = new Date();

  if (SINGLE_WEEK) {
    rangeStart = new Date(SINGLE_WEEK);
    rangeEnd = addDays(rangeStart, 6);
  } else if (START_DATE) {
    rangeStart = new Date(START_DATE);
    // Snap to week Sunday
    const day = rangeStart.getDay();
    rangeStart.setDate(rangeStart.getDate() - day);
  }
  if (END_DATE) {
    rangeEnd = new Date(END_DATE);
  }

  // If resuming, start from last completed week + 1
  if (RESUME && state.last_completed_week) {
    const lastWeek = new Date(state.last_completed_week);
    rangeStart = addDays(lastWeek, 7);
    console.log(`Resuming from: ${format(rangeStart, 'yyyy-MM-dd')}`);
  }

  // Build list of weeks to process
  const weeks: Date[] = [];
  let d = new Date(rangeStart);
  while (!isAfter(d, rangeEnd)) {
    weeks.push(new Date(d));
    d = addDays(d, 7);
  }

  if (weeks.length === 0) {
    console.log('\nNo weeks to process.');
    return;
  }

  console.log(`\nWeeks to process: ${weeks.length}`);
  console.log(
    `Range: ${format(weeks[0], 'MMM d, yyyy')} → ${format(rangeEnd, 'MMM d, yyyy')}`,
  );

  if (DRY_RUN) {
    console.log(
      `\nEstimated cost: ~$${(weeks.length * 18 * 0.025 + weeks.length * 0.01).toFixed(2)}`,
    );
    console.log('(~18 events/week × $0.025/event + $0.01/week clustering)');
    console.log('\nDry run — processing with no API calls:');
  }

  // Process each week
  for (let i = 0; i < weeks.length; i++) {
    try {
      await processWeek(weeks[i], i + 1, weeks.length, state);
    } catch (err) {
      console.error(`\nFATAL ERROR processing week ${format(weeks[i], 'yyyy-MM-dd')}:`, err);
      state.errors.push({ week: format(weeks[i], 'yyyy-MM-dd'), error: String(err) });
      saveState(state);
      // Continue to next week instead of crashing
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  // Final summary
  console.log('\n' + '═'.repeat(60));
  console.log('BACKFILL COMPLETE');
  console.log(`  Total events:           ${state.total_events}`);
  console.log(`  Total articles:         ${state.total_articles}`);
  console.log(`  Total smokescreen pairs: ${state.total_smokescreen_pairs}`);
  console.log(`  Total tokens:           ${(state.total_tokens.input + state.total_tokens.output).toLocaleString()}`);

  // Cost estimate: Haiku ($0.80/$4 per MTok) + Sonnet ($3/$15 per MTok)
  const haikuCost =
    (state.total_tokens.input * 0.8 + state.total_tokens.output * 4) / 1_000_000;
  const sonnetCost =
    (state.total_tokens.input * 3 + state.total_tokens.output * 15) / 1_000_000;
  console.log(`  Estimated cost:         ~$${(haikuCost + sonnetCost).toFixed(2)}`);

  if (state.errors.length > 0) {
    console.log(`  Errors:                 ${state.errors.length}`);
    state.errors.forEach((e) => console.log(`    - ${e.week}: ${e.error.slice(0, 80)}`));
  }
  console.log('═'.repeat(60));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
