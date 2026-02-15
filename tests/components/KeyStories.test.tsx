import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KeyStories } from '@/components/KeyStories';
import type { Event } from '@/lib/types';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'evt-1',
    week_id: '2026-02-09',
    title: 'Test Event',
    event_date: '2026-02-10',
    created_at: '2026-02-10T00:00:00Z',
    updated_at: '2026-02-10T00:00:00Z',
    related_event_id: null,
    actors: null,
    institution: null,
    topic_tags: null,
    primary_docs: null,
    mechanism_of_harm: null,
    mechanism_secondary: null,
    scope: null,
    affected_population: null,
    summary: 'Test summary',
    factual_claims: [],
    score_rationale: null,
    action_item: null,
    a_score: 60,
    a_components: null,
    a_severity_multiplier: 1,
    b_score: 30,
    b_layer1_hype: null,
    b_layer2_distraction: null,
    b_intentionality_score: null,
    attention_budget: null,
    dominance_margin: null,
    primary_list: 'A',
    is_mixed: false,
    noise_flag: false,
    noise_reason_codes: null,
    noise_score: null,
    article_count: 3,
    media_volume: null,
    search_attention: null,
    confidence: 0.8,
    human_reviewed: false,
    score_version: 1,
    score_frozen: false,
    frozen_at: null,
    frozen_by: null,
    correction_notice: null,
    correction_at: null,
    ...overrides,
  };
}

describe('KeyStories', () => {
  it('returns null with no events', () => {
    const { container } = render(
      <KeyStories topDamage={null} topDistraction={null} topSmokescreenPair={null} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders top damage and distraction cards', () => {
    const damage = makeEvent({ id: 'dmg-1', title: 'Executive Order Signed', a_score: 72, b_score: 30 });
    const distraction = makeEvent({ id: 'dst-1', title: 'Celebrity Tweet Storm', a_score: 15, b_score: 65, primary_list: 'B' });

    render(
      <KeyStories topDamage={damage} topDistraction={distraction} topSmokescreenPair={null} />
    );

    expect(screen.getByText('Top Damage')).toBeInTheDocument();
    expect(screen.getByText('Executive Order Signed')).toBeInTheDocument();
    expect(screen.getByText('Top Distraction')).toBeInTheDocument();
    expect(screen.getByText('Celebrity Tweet Storm')).toBeInTheDocument();
  });

  it('renders smokescreen pair when SI >= 25', () => {
    const damage = makeEvent({ id: 'dmg-1', title: 'Damage Event' });
    const distraction = makeEvent({ id: 'dst-1', title: 'Distraction Event', primary_list: 'B' });

    const smokescreenPair = {
      pair: {
        id: 'sp-1',
        week_id: '2026-02-09',
        distraction_event_id: 'dst-1',
        damage_event_id: 'dmg-1',
        smokescreen_index: 45.2,
        time_delta_hours: null,
        a_coverage_share_before: null,
        a_coverage_share_after: null,
        displacement_delta: null,
        displacement_confidence: null,
        evidence_notes: null,
        created_at: '2026-02-10T00:00:00Z',
        distraction_event: { id: 'dst-1', title: 'Distraction Event', a_score: 15, b_score: 65 },
        damage_event: { id: 'dmg-1', title: 'Damage Event', a_score: 72, b_score: 30 },
      },
    };

    render(
      <KeyStories topDamage={damage} topDistraction={distraction} topSmokescreenPair={smokescreenPair} />
    );

    expect(screen.getByText('Smokescreen Pair')).toBeInTheDocument();
    expect(screen.getByText('is obscuring')).toBeInTheDocument();
    expect(screen.getByText('SI: 45.2')).toBeInTheDocument();
  });

  it('does not render smokescreen when pair is null', () => {
    const damage = makeEvent({ id: 'dmg-1', title: 'Damage Event' });

    render(
      <KeyStories topDamage={damage} topDistraction={null} topSmokescreenPair={null} />
    );

    expect(screen.queryByText('Smokescreen Pair')).not.toBeInTheDocument();
  });

  it('links to event detail pages', () => {
    const damage = makeEvent({ id: 'dmg-1', title: 'Damage Event' });
    const distraction = makeEvent({ id: 'dst-1', title: 'Distraction Event', primary_list: 'B' });

    render(
      <KeyStories topDamage={damage} topDistraction={distraction} topSmokescreenPair={null} />
    );

    const damageLink = screen.getByText('Damage Event').closest('a');
    expect(damageLink).toHaveAttribute('href', '/event/dmg-1');

    const distractionLink = screen.getByText('Distraction Event').closest('a');
    expect(distractionLink).toHaveAttribute('href', '/event/dst-1');
  });
});
