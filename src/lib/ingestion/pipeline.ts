// ═══════════════════════════════════════════════════════════════
// Ingestion Pipeline — Full orchestration
// Fetches articles, deduplicates, clusters, scores, stores
// ═══════════════════════════════════════════════════════════════

import { createAdminClient } from '@/lib/supabase/admin';
import { fetchGdeltRecent } from './gdelt';
import { fetchGNewsRecent } from './gnews';
import { fetchGoogleNewsRecent } from './google-news';
import { deduplicateArticles } from './dedup';
import { clusterArticlesIntoEvents } from './cluster';
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

/**
 * Run the full ingestion pipeline.
 * Called by /api/ingest every 4 hours.
 */
export async function runIngestPipeline(): Promise<PipelineResult> {
  const supabase = createAdminClient();
  const errors: string[] = [];
  let totalInput = 0;
  let totalOutput = 0;

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

    // 3. Fetch articles from all sources
    const [gdeltArticles, gnewsArticles, googleArticles] = await Promise.allSettled([
      fetchGdeltRecent(6),
      fetchGNewsRecent(),
      fetchGoogleNewsRecent(),
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

    if (newArticles.length === 0) {
      await finishRun(supabase, runId, 'completed', {
        articles_fetched: articlesFetched,
        articles_new: 0,
        events_created: 0,
        events_scored: 0,
        errors,
      });
      return {
        run_id: runId,
        articles_fetched: articlesFetched,
        articles_new: 0,
        events_created: 0,
        events_scored: 0,
        smokescreen_pairs_created: 0,
        errors,
        tokens: { input: 0, output: 0 },
      };
    }

    // 6. Get existing events for this week (for clustering context)
    const { data: existingEvents } = await supabase
      .from('events')
      .select('id, title')
      .eq('week_id', currentWeekId);

    const existingEventTitles = (existingEvents || []).map((e) => e.title);

    // 7. Cluster articles into events
    const { events: identifiedEvents, tokens: clusterTokens } =
      await clusterArticlesIntoEvents(newArticles, existingEventTitles);
    totalInput += clusterTokens.input;
    totalOutput += clusterTokens.output;

    // 8. Store new articles
    const articleInserts = newArticles.map((a) => ({
      url: a.url,
      headline: a.headline,
      publisher: a.publisher,
      published_at: a.published_at,
      week_id: currentWeekId,
      ingestion_source: a.source,
    }));

    if (articleInserts.length > 0) {
      const { error: articleError } = await supabase
        .from('articles')
        .upsert(articleInserts, { onConflict: 'url', ignoreDuplicates: true });
      if (articleError) errors.push(`Article insert error: ${articleError.message}`);
    }

    // 9. Create and score new events
    let eventsCreated = 0;
    let eventsScored = 0;

    for (const identified of identifiedEvents) {
      try {
        // Check if this event matches an existing one (by title similarity)
        const isExisting = existingEventTitles.some(
          (t) => t.toLowerCase() === identified.title.toLowerCase(),
        );
        if (isExisting) {
          // Just link new articles to existing event — skip creation
          continue;
        }

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

        // Score the event
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

    // 10. Auto-freeze events older than 48h
    await supabase.rpc('auto_freeze_events');

    // 11. Run smokescreen pairing
    let smokescreenPairsCreated = 0;
    const { data: weekEvents } = await supabase
      .from('events')
      .select('*')
      .eq('week_id', currentWeekId);

    if (weekEvents && weekEvents.length > 0) {
      const pairs = pairSmokescreens(weekEvents as Event[]);

      // Clear existing pairs for this week and re-insert
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

    // 12. Recompute week stats
    await supabase.rpc('compute_week_stats', { target_week_id: currentWeekId });

    // 13. Finish
    await finishRun(supabase, runId, 'completed', {
      articles_fetched: articlesFetched,
      articles_new: articlesNew,
      events_created: eventsCreated,
      events_scored: eventsScored,
      errors,
      metadata: { tokens: { input: totalInput, output: totalOutput } },
    });

    return {
      run_id: runId,
      articles_fetched: articlesFetched,
      articles_new: articlesNew,
      events_created: eventsCreated,
      events_scored: eventsScored,
      smokescreen_pairs_created: smokescreenPairsCreated,
      errors,
      tokens: { input: totalInput, output: totalOutput },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Pipeline fatal error: ${msg}`);
    await finishRun(supabase, runId, 'failed', { errors });
    throw err;
  }
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
