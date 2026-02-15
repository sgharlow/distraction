// ═══════════════════════════════════════════════════════════════
// Ingestion Pipeline — Split into two phases for Vercel 60s limit
// Phase 1 (ingest): Fetch → Dedup → Store articles (~15s)
// Phase 2 (process): Cluster → Score → Pair smokescreens (~45s)
// ═══════════════════════════════════════════════════════════════

import { createAdminClient } from '@/lib/supabase/admin';
import { fetchGdeltRecent } from './gdelt';
import { fetchGNewsRecent } from './gnews';
import { fetchGoogleNewsRecent } from './google-news';
import { deduplicateArticles } from './dedup';
import { clusterArticlesIntoEvents } from './cluster';
import { mergeIdentifiedEvents } from './merge-events';
import { scoreEvent } from '@/lib/scoring/service';
import { pairSmokescreens } from '@/lib/scoring/service';
import { getWeekIdForDate } from '@/lib/weeks';
import type { ArticleInput } from './types';
import type { Event } from '@/lib/types';

export interface PipelineResult {
  run_id: string;
  articles_fetched: number;
  articles_new: number;
  events_created: number;
  events_scored: number;
  smokescreen_pairs_created: number;
  errors: string[];
  tokens: { input: number; output: number };
}

// Max time budget (50s to leave 10s buffer for Vercel's 60s limit)
const PIPELINE_TIMEOUT_MS = 50_000;

/**
 * Phase 1: Fetch and store articles only. No Claude API calls.
 * Called by /api/ingest every 4 hours. Completes in ~15-20s.
 */
export async function runIngestPipeline(): Promise<PipelineResult> {
  const supabase = createAdminClient();
  const errors: string[] = [];

  // Clean up stale 'running' records from previous timed-out runs
  await supabase
    .from('pipeline_runs')
    .update({ status: 'failed', completed_at: new Date().toISOString(), errors: ['Timed out (stale running state)'] })
    .eq('status', 'running')
    .lt('started_at', new Date(Date.now() - 120_000).toISOString());

  // 1. Create pipeline run record
  const { data: run } = await supabase
    .from('pipeline_runs')
    .insert({ run_type: 'ingest', status: 'running' })
    .select()
    .single();
  const runId = run?.id || 'unknown';

  try {
    // 2. Ensure current week exists
    await supabase.rpc('ensure_current_week');

    // 3. Fetch articles from all sources (in parallel, 10s timeout each)
    const [gdeltArticles, gnewsArticles, googleArticles] = await Promise.allSettled([
      fetchGdeltRecent(6).catch((e) => { errors.push(`GDELT: ${e.message}`); return [] as ArticleInput[]; }),
      fetchGNewsRecent().catch((e) => { errors.push(`GNews: ${e.message}`); return [] as ArticleInput[]; }),
      fetchGoogleNewsRecent().catch((e) => { errors.push(`Google: ${e.message}`); return [] as ArticleInput[]; }),
    ]);

    const allArticles: ArticleInput[] = [];
    if (gdeltArticles.status === 'fulfilled') allArticles.push(...gdeltArticles.value);
    else errors.push(`GDELT fetch failed: ${gdeltArticles.reason}`);

    if (gnewsArticles.status === 'fulfilled') allArticles.push(...gnewsArticles.value);
    else errors.push(`GNews fetch failed: ${gnewsArticles.reason}`);

    if (googleArticles.status === 'fulfilled') allArticles.push(...googleArticles.value);
    else errors.push(`Google News fetch failed: ${googleArticles.reason}`);

    const articlesFetched = allArticles.length;

    // 4. Get existing article URLs for dedup
    const currentWeekId = getWeekIdForDate(new Date());
    const { data: existingArticles } = await supabase
      .from('articles')
      .select('url')
      .eq('week_id', currentWeekId);

    const existingUrls = new Set((existingArticles || []).map((a) => a.url));

    // 5. Deduplicate
    const newArticles = deduplicateArticles(allArticles, existingUrls);
    const articlesNew = newArticles.length;

    // 6. Store new articles
    if (newArticles.length > 0) {
      const articleInserts = newArticles.map((a) => ({
        url: a.url,
        headline: a.headline,
        publisher: a.publisher,
        published_at: a.published_at,
        week_id: currentWeekId,
        ingestion_source: a.source,
      }));

      const { error: articleError } = await supabase
        .from('articles')
        .upsert(articleInserts, { onConflict: 'url', ignoreDuplicates: true });
      if (articleError) errors.push(`Article insert error: ${articleError.message}`);
    }

    // 7. Auto-freeze events older than 48h
    await supabase.rpc('auto_freeze_events');

    // 8. Finish — articles stored, processing deferred to /api/process
    await finishRun(supabase, runId, 'completed', {
      articles_fetched: articlesFetched,
      articles_new: articlesNew,
      events_created: 0,
      events_scored: 0,
      errors,
    });

    return {
      run_id: runId,
      articles_fetched: articlesFetched,
      articles_new: articlesNew,
      events_created: 0,
      events_scored: 0,
      smokescreen_pairs_created: 0,
      errors,
      tokens: { input: 0, output: 0 },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Pipeline fatal error: ${msg}`);
    await finishRun(supabase, runId, 'failed', { errors });
    throw err;
  }
}

/**
 * Phase 2: Cluster unassigned articles into events and score them.
 * Called by /api/process every 4 hours (offset from ingest).
 * Uses Claude API for clustering and scoring.
 */
export async function runProcessPipeline(): Promise<PipelineResult> {
  const supabase = createAdminClient();
  const errors: string[] = [];
  let totalInput = 0;
  let totalOutput = 0;
  const startTime = Date.now();

  const timeLeft = () => PIPELINE_TIMEOUT_MS - (Date.now() - startTime);
  const hasTime = () => timeLeft() > 5000;

  // 1. Create pipeline run record
  const { data: run } = await supabase
    .from('pipeline_runs')
    .insert({ run_type: 'process', status: 'running' })
    .select()
    .single();
  const runId = run?.id || 'unknown';

  try {
    const currentWeekId = getWeekIdForDate(new Date());

    // 2. Get unassigned articles (no event_id) for current week
    const { data: unassignedArticles } = await supabase
      .from('articles')
      .select('url, headline, publisher, published_at, ingestion_source')
      .eq('week_id', currentWeekId)
      .is('event_id', null)
      .limit(50);

    const newArticles: ArticleInput[] = (unassignedArticles || []).map((a) => ({
      url: a.url,
      headline: a.headline,
      publisher: a.publisher || 'unknown',
      published_at: a.published_at,
      source: a.ingestion_source || 'unknown',
    }));

    if (newArticles.length === 0) {
      // No unassigned articles — just do smokescreen pairing + stats
      await runPostProcessing(supabase, currentWeekId, errors);
      await finishRun(supabase, runId, 'completed', {
        articles_fetched: 0,
        articles_new: 0,
        events_created: 0,
        events_scored: 0,
        errors,
      });
      return {
        run_id: runId,
        articles_fetched: 0,
        articles_new: 0,
        events_created: 0,
        events_scored: 0,
        smokescreen_pairs_created: 0,
        errors,
        tokens: { input: totalInput, output: totalOutput },
      };
    }

    // 3. Get existing events for clustering context
    const { data: existingEvents } = await supabase
      .from('events')
      .select('id, title')
      .eq('week_id', currentWeekId);

    const existingEventTitles = (existingEvents || []).map((e) => e.title);

    // 4. Cluster articles into events (1 Claude Haiku call)
    const { events: rawIdentifiedEvents, tokens: clusterTokens } =
      await clusterArticlesIntoEvents(newArticles, existingEventTitles);
    totalInput += clusterTokens.input;
    totalOutput += clusterTokens.output;

    // 4b. Post-clustering merge: deduplicate similar event titles
    const identifiedEvents = mergeIdentifiedEvents(rawIdentifiedEvents, existingEventTitles);

    // 5. Create and score new events (limited by time budget)
    let eventsCreated = 0;
    let eventsScored = 0;
    const MAX_EVENTS_PER_RUN = 2;

    for (const identified of identifiedEvents) {
      if (!hasTime()) {
        errors.push(`Time budget exceeded — ${identifiedEvents.length - eventsCreated} events deferred`);
        break;
      }

      try {
        // Check if this event matches an existing one
        const isExisting = existingEventTitles.some(
          (t) => t.toLowerCase() === identified.title.toLowerCase(),
        );
        if (isExisting) continue;

        // Create the event
        const { data: newEvent, error: eventError } = await supabase
          .from('events')
          .insert({
            week_id: currentWeekId,
            title: identified.title,
            event_date: identified.event_date,
            summary: identified.summary,
            mechanism_of_harm: identified.mechanism_of_harm,
            scope: identified.scope,
            affected_population: identified.affected_population,
            actors: identified.actors,
            institution: identified.institution,
            topic_tags: identified.topic_tags,
            confidence: identified.confidence,
          })
          .select()
          .single();

        if (eventError || !newEvent) {
          errors.push(`Event create error: ${eventError?.message || 'no data'}`);
          continue;
        }
        eventsCreated++;

        // Link articles to this event
        const articleUrls = identified.article_indices
          .filter((i) => i < newArticles.length)
          .map((i) => newArticles[i].url);

        if (articleUrls.length > 0) {
          await supabase
            .from('articles')
            .update({ event_id: newEvent.id })
            .in('url', articleUrls);
        }

        // Score the event (if we have time and haven't hit the limit)
        if (eventsScored >= MAX_EVENTS_PER_RUN || !hasTime()) {
          errors.push(`Scoring deferred for "${identified.title}"`);
          continue;
        }

        const articleHeadlines = identified.article_indices
          .filter((i) => i < newArticles.length)
          .map((i) => newArticles[i].headline);

        const { result: scoreResult, tokens: scoreTokens, prompt_version } =
          await scoreEvent({
            title: identified.title,
            summary: identified.summary,
            mechanism: identified.mechanism_of_harm,
            scope: identified.scope,
            affected_population: identified.affected_population,
            articleHeadlines,
            weekEventTitles: existingEventTitles,
          });

        totalInput += scoreTokens.input;
        totalOutput += scoreTokens.output;

        // Update event with scores
        await supabase
          .from('events')
          .update({
            a_score: scoreResult.a_score.final_score,
            a_components: scoreResult.a_score as object,
            a_severity_multiplier:
              (scoreResult.a_score.severity.durability +
                scoreResult.a_score.severity.reversibility +
                scoreResult.a_score.severity.precedent) /
              3,
            b_score: scoreResult.b_score.final_score,
            b_layer1_hype: scoreResult.b_score.layer1 as object,
            b_layer2_distraction: scoreResult.b_score.layer2 as object,
            b_intentionality_score: scoreResult.b_score.intentionality.total,
            primary_list: scoreResult.primary_list,
            is_mixed: scoreResult.is_mixed,
            noise_flag: scoreResult.noise_flag,
            noise_reason_codes: scoreResult.noise_reason_codes,
            confidence: scoreResult.confidence,
            score_rationale: scoreResult.score_rationale,
            action_item: scoreResult.action_item,
            factual_claims: scoreResult.factual_claims as object,
            article_count: articleHeadlines.length,
          })
          .eq('id', newEvent.id);

        // Log score change
        await supabase.from('score_changes').insert({
          event_id: newEvent.id,
          week_id: currentWeekId,
          changed_by: 'auto',
          change_type: 'initial',
          new_a_score: scoreResult.a_score.final_score,
          new_b_score: scoreResult.b_score.final_score,
          new_list: scoreResult.primary_list,
          reason: 'Initial automated scoring',
          version_after: 1,
          prompt_version,
          llm_response: scoreResult as object,
        });

        eventsScored++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Event scoring error for "${identified.title}": ${msg}`);
      }
    }

    // 6. Run post-processing (smokescreen pairing + stats)
    let smokescreenPairsCreated = 0;
    if (hasTime()) {
      smokescreenPairsCreated = await runPostProcessing(supabase, currentWeekId, errors);
    }

    // 7. Finish
    await finishRun(supabase, runId, 'completed', {
      articles_fetched: 0,
      articles_new: newArticles.length,
      events_created: eventsCreated,
      events_scored: eventsScored,
      errors,
      metadata: { tokens: { input: totalInput, output: totalOutput } },
    });

    return {
      run_id: runId,
      articles_fetched: 0,
      articles_new: newArticles.length,
      events_created: eventsCreated,
      events_scored: eventsScored,
      smokescreen_pairs_created: smokescreenPairsCreated,
      errors,
      tokens: { input: totalInput, output: totalOutput },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Process pipeline fatal error: ${msg}`);
    await finishRun(supabase, runId, 'failed', { errors });
    throw err;
  }
}

/**
 * Smokescreen pairing + week stats recomputation.
 */
async function runPostProcessing(
  supabase: ReturnType<typeof createAdminClient>,
  currentWeekId: string,
  errors: string[],
): Promise<number> {
  let smokescreenPairsCreated = 0;

  const { data: weekEvents } = await supabase
    .from('events')
    .select('*')
    .eq('week_id', currentWeekId);

  if (weekEvents && weekEvents.length > 0) {
    const pairs = pairSmokescreens(weekEvents as Event[]);

    await supabase
      .from('smokescreen_pairs')
      .delete()
      .eq('week_id', currentWeekId);

    for (const pair of pairs) {
      const { error: pairError } = await supabase.from('smokescreen_pairs').insert({
        week_id: currentWeekId,
        distraction_event_id: pair.distraction_event.id,
        damage_event_id: pair.damage_event.id,
        smokescreen_index: pair.final_si,
        displacement_confidence: pair.displacement_confidence,
      });
      if (!pairError) smokescreenPairsCreated++;
    }
  }

  await supabase.rpc('compute_week_stats', { target_week_id: currentWeekId });

  return smokescreenPairsCreated;
}

async function finishRun(
  supabase: ReturnType<typeof createAdminClient>,
  runId: string,
  status: 'completed' | 'failed',
  data: Record<string, unknown>,
) {
  await supabase
    .from('pipeline_runs')
    .update({
      status,
      completed_at: new Date().toISOString(),
      ...data,
    })
    .eq('id', runId);
}
