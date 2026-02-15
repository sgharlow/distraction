import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeekBriefing } from '@/components/WeekBriefing';
import type { WeeklySnapshot, Event } from '@/lib/types';

function makeSnapshot(overrides: Partial<WeeklySnapshot> = {}): WeeklySnapshot {
  return {
    id: 'snap-1',
    week_id: '2026-02-09',
    week_start: '2026-02-09',
    week_end: '2026-02-15',
    status: 'live',
    frozen_at: null,
    total_events: 5,
    list_a_count: 2,
    list_b_count: 2,
    list_c_count: 1,
    avg_a_score: 45.0,
    avg_b_score: 38.0,
    max_smokescreen_index: null,
    top_smokescreen_pair: null,
    week_attention_budget: 7.0,
    total_sources: 42,
    primary_doc_count: 3,
    weekly_summary: null,
    editors_pick_event_id: null,
    created_at: '2026-02-09T00:00:00Z',
    ...overrides,
  };
}

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'evt-1',
    week_id: '2026-02-09',
    title: 'Test Event',
    event_date: '2026-02-10',
    summary: 'A test event summary',
    score_rationale: null,
    primary_list: 'A',
    is_mixed: false,
    noise_flag: false,
    noise_reason_codes: null,
    noise_score: null,
    a_score: 50.0,
    b_score: 20.0,
    a_components: null,
    b_layer1_hype: null,
    b_layer2_distraction: null,
    b_intentionality_score: null,
    attention_budget: -30,
    dominance_margin: 30,
    mechanism_of_harm: null,
    scope: null,
    affected_population: null,
    actors: null,
    institution: null,
    topic_tags: null,
    primary_docs: null,
    action_item: null,
    factual_claims: null,
    article_count: 5,
    confidence: 0.85,
    score_version: 1,
    score_frozen: false,
    frozen_at: null,
    frozen_by: null,
    correction_notice: null,
    correction_at: null,
    created_at: '2026-02-10T00:00:00Z',
    updated_at: '2026-02-10T00:00:00Z',
    ...overrides,
  } as Event;
}

describe('WeekBriefing', () => {
  it('renders nothing for frozen weeks', () => {
    const snapshot = makeSnapshot({ status: 'frozen' });
    const { container } = render(
      <WeekBriefing snapshot={snapshot} topDamage={[makeEvent()]} topDistraction={[]} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing for live weeks with no events', () => {
    const snapshot = makeSnapshot({ total_events: 0 });
    const { container } = render(
      <WeekBriefing snapshot={snapshot} topDamage={[]} topDistraction={[]} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders briefing text for live weeks with events', () => {
    const snapshot = makeSnapshot();
    const topA = makeEvent({ title: 'Big Damage', a_score: 72.5 });
    const topB = makeEvent({ title: 'Shiny Distraction', b_score: 65.0, primary_list: 'B' });

    render(
      <WeekBriefing snapshot={snapshot} topDamage={[topA]} topDistraction={[topB]} />,
    );

    expect(screen.getByText('THIS WEEK IN 30 SECONDS')).toBeInTheDocument();
    expect(screen.getByText(/Big Damage/)).toBeInTheDocument();
    expect(screen.getByText(/Shiny Distraction/)).toBeInTheDocument();
  });

  it('renders header with correct styling classes', () => {
    const snapshot = makeSnapshot();
    const topA = makeEvent({ title: 'Damage Event', a_score: 50.0 });

    render(
      <WeekBriefing snapshot={snapshot} topDamage={[topA]} topDistraction={[]} />,
    );

    const header = screen.getByText('THIS WEEK IN 30 SECONDS');
    expect(header.className).toContain('text-mixed');
    expect(header.className).toContain('tracking-widest');
  });
});
