import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { scoreEvent } from '@/lib/scoring/service';

export const maxDuration = 30;

/**
 * POST /api/score
 * Scores or re-scores a single event using Claude API.
 * Called by admin for manual re-scoring.
 *
 * Body: { event_id: string }
 */
export async function POST(request: NextRequest) {
  // Verify cron secret or admin auth
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { event_id } = body;

  if (!event_id) {
    return NextResponse.json({ error: 'event_id required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    // 1. Fetch the event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', event_id)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Don't re-score frozen events (unless admin override)
    if (event.score_frozen) {
      return NextResponse.json(
        { error: 'Event is frozen. Use admin override to re-score.' },
        { status: 409 },
      );
    }

    // 2. Get associated articles
    const { data: articles } = await supabase
      .from('articles')
      .select('headline')
      .eq('event_id', event_id);

    const articleHeadlines = (articles || [])
      .map((a) => a.headline)
      .filter(Boolean) as string[];

    // 3. Get other events this week for context
    const { data: weekEvents } = await supabase
      .from('events')
      .select('title')
      .eq('week_id', event.week_id)
      .neq('id', event_id);

    const weekEventTitles = (weekEvents || []).map((e) => e.title);

    // 4. Score
    const oldAScore = event.a_score;
    const oldBScore = event.b_score;
    const oldList = event.primary_list;

    const { result, tokens, prompt_version } = await scoreEvent({
      title: event.title,
      summary: event.summary,
      mechanism: event.mechanism_of_harm,
      scope: event.scope,
      affected_population: event.affected_population,
      articleHeadlines,
      weekEventTitles,
    });

    // 5. Update event
    const newVersion = (event.score_version || 1) + 1;

    await supabase
      .from('events')
      .update({
        a_score: result.a_score.final_score,
        a_components: result.a_score as any,
        a_severity_multiplier:
          (result.a_score.severity.durability +
            result.a_score.severity.reversibility +
            result.a_score.severity.precedent) /
          3,
        b_score: result.b_score.final_score,
        b_layer1_hype: result.b_score.layer1 as any,
        b_layer2_distraction: result.b_score.layer2 as any,
        b_intentionality_score: result.b_score.intentionality.total,
        primary_list: result.primary_list,
        is_mixed: result.is_mixed,
        noise_flag: result.noise_flag,
        noise_reason_codes: result.noise_reason_codes,
        confidence: result.confidence,
        score_rationale: result.score_rationale,
        action_item: result.action_item,
        factual_claims: result.factual_claims as any,
        score_version: newVersion,
      })
      .eq('id', event_id);

    // 6. Log score change
    await supabase.from('score_changes').insert({
      event_id,
      week_id: event.week_id,
      changed_by: 'auto',
      change_type: 'rescore',
      old_a_score: oldAScore,
      new_a_score: result.a_score.final_score,
      old_b_score: oldBScore,
      new_b_score: result.b_score.final_score,
      old_list: oldList,
      new_list: result.primary_list,
      reason: 'Manual re-score via API',
      version_before: event.score_version,
      version_after: newVersion,
      prompt_version,
      llm_response: result as any,
    });

    // 7. Recompute week stats
    await supabase.rpc('compute_week_stats', { target_week_id: event.week_id });

    return NextResponse.json({
      success: true,
      event_id,
      a_score: result.a_score.final_score,
      b_score: result.b_score.final_score,
      primary_list: result.primary_list,
      is_mixed: result.is_mixed,
      version: newVersion,
      tokens,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Score error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
