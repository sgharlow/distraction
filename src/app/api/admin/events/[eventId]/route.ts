import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { classifyEvent } from '@/lib/scoring/classify';
import type { MechanismOfHarm, NoiseReasonCode } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/events/[eventId] — Full event detail
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { eventId } = await params;
  const supabase = createAdminClient();

  const [{ data: event, error }, { data: scoreChanges }, { data: articles }] =
    await Promise.all([
      supabase.from('events').select('*').eq('id', eventId).single(),
      supabase
        .from('score_changes')
        .select('*')
        .eq('event_id', eventId)
        .order('changed_at', { ascending: false }),
      supabase
        .from('articles')
        .select('*')
        .eq('event_id', eventId)
        .order('published_at', { ascending: false }),
    ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  return NextResponse.json({ event, score_changes: scoreChanges || [], articles: articles || [] });
}

/**
 * PATCH /api/admin/events/[eventId] — Update event fields
 * Body: partial Event fields + optional score overrides
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { eventId } = await params;
  const body = await request.json();
  const supabase = createAdminClient();

  // Fetch current event for score change logging
  const { data: current, error: fetchErr } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (fetchErr || !current) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  // Allowed fields for direct update
  const allowedFields = [
    'title', 'summary', 'action_item', 'score_rationale',
    'actors', 'institution', 'topic_tags', 'event_date',
    'mechanism_of_harm', 'scope', 'affected_population',
    'primary_list', 'is_mixed', 'noise_flag',
    'score_frozen', 'human_reviewed',
    'correction_notice', 'correction_at',
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key];
  }

  // Score override handling
  const isScoreOverride = 'a_score' in body || 'b_score' in body;
  if (isScoreOverride) {
    const newA = body.a_score ?? current.a_score;
    const newB = body.b_score ?? current.b_score;

    updates.a_score = newA;
    updates.b_score = newB;
    updates.dominance_margin = newA != null && newB != null ? newA - newB : null;

    // Reclassify unless list is being manually set
    if (!('primary_list' in body)) {
      const classification = classifyEvent({
        a_score: newA ?? 0,
        b_score: newB ?? 0,
        mechanism_of_harm: (updates.mechanism_of_harm ?? current.mechanism_of_harm) as MechanismOfHarm | null,
        has_institutional_lever: !!(updates.mechanism_of_harm ?? current.mechanism_of_harm) &&
          (updates.mechanism_of_harm ?? current.mechanism_of_harm) !== 'norm_erosion_only',
        noise_indicators: (current.noise_reason_codes || []) as NoiseReasonCode[],
      });
      updates.primary_list = classification.primary_list;
      updates.is_mixed = classification.is_mixed;
      updates.noise_flag = classification.noise_flag;
    }

    const newVersion = (current.score_version || 1) + 1;
    updates.score_version = newVersion;

    // Log score change
    await supabase.from('score_changes').insert({
      event_id: eventId,
      week_id: current.week_id,
      changed_by: user.email || 'admin',
      change_type: 'override',
      old_a_score: current.a_score,
      new_a_score: newA,
      old_b_score: current.b_score,
      new_b_score: newB,
      old_list: current.primary_list,
      new_list: updates.primary_list ?? current.primary_list,
      reason: body.override_reason || 'Admin override',
      version_before: current.score_version,
      version_after: newVersion,
    });
  }

  // Correction handling
  if ('correction_notice' in body && body.correction_notice && !body.correction_at) {
    updates.correction_at = new Date().toISOString();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', eventId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Recompute week stats if scores changed
  if (isScoreOverride) {
    await supabase.rpc('compute_week_stats', { target_week_id: current.week_id });
  }

  return NextResponse.json({ event: data });
}

/**
 * POST /api/admin/events/[eventId] — Re-score event via Claude
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { eventId } = await params;
  const supabase = createAdminClient();

  const { data: event, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (error || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  if (event.score_frozen) {
    return NextResponse.json(
      { error: 'Event is frozen. Unfreeze first to re-score.' },
      { status: 409 },
    );
  }

  // Dynamic import to avoid loading Claude SDK at route registration
  const { scoreEvent } = await import('@/lib/scoring/service');

  const { data: articles } = await supabase
    .from('articles')
    .select('headline')
    .eq('event_id', eventId);

  const { data: weekEvents } = await supabase
    .from('events')
    .select('title')
    .eq('week_id', event.week_id)
    .neq('id', eventId);

  const { result, tokens, prompt_version } = await scoreEvent({
    title: event.title,
    summary: event.summary,
    mechanism: event.mechanism_of_harm,
    scope: event.scope,
    affected_population: event.affected_population,
    articleHeadlines: (articles || []).map((a) => a.headline).filter(Boolean) as string[],
    weekEventTitles: (weekEvents || []).map((e) => e.title),
  });

  const newVersion = (event.score_version || 1) + 1;

  await supabase
    .from('events')
    .update({
      a_score: result.a_score.final_score,
      a_components: result.a_score as object,
      a_severity_multiplier:
        (result.a_score.severity.durability +
          result.a_score.severity.reversibility +
          result.a_score.severity.precedent) / 3,
      b_score: result.b_score.final_score,
      b_layer1_hype: result.b_score.layer1 as object,
      b_layer2_distraction: result.b_score.layer2 as object,
      b_intentionality_score: result.b_score.intentionality.total,
      primary_list: result.primary_list,
      is_mixed: result.is_mixed,
      noise_flag: result.noise_flag,
      noise_reason_codes: result.noise_reason_codes,
      confidence: result.confidence,
      score_rationale: result.score_rationale,
      action_item: result.action_item,
      factual_claims: result.factual_claims as object,
      dominance_margin: result.a_score.final_score - result.b_score.final_score,
      score_version: newVersion,
    })
    .eq('id', eventId);

  await supabase.from('score_changes').insert({
    event_id: eventId,
    week_id: event.week_id,
    changed_by: user.email || 'admin',
    change_type: 'rescore',
    old_a_score: event.a_score,
    new_a_score: result.a_score.final_score,
    old_b_score: event.b_score,
    new_b_score: result.b_score.final_score,
    old_list: event.primary_list,
    new_list: result.primary_list,
    reason: 'Admin re-score via Claude',
    version_before: event.score_version,
    version_after: newVersion,
    prompt_version,
    llm_response: result as object,
  });

  await supabase.rpc('compute_week_stats', { target_week_id: event.week_id });

  return NextResponse.json({
    success: true,
    a_score: result.a_score.final_score,
    b_score: result.b_score.final_score,
    primary_list: result.primary_list,
    is_mixed: result.is_mixed,
    version: newVersion,
    tokens,
  });
}
