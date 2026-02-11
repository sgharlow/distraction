import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SmokescreenAlert } from '@/components/SmokescreenAlert';
import type { WeeklySnapshot } from '@/lib/types';

function makeSnapshot(overrides: Partial<WeeklySnapshot> = {}): WeeklySnapshot {
  return {
    id: 'test-id',
    week_id: '2025-01-05',
    week_start: '2025-01-05',
    week_end: '2025-01-11',
    status: 'live',
    frozen_at: null,
    total_events: 10,
    list_a_count: 4,
    list_b_count: 4,
    list_c_count: 2,
    avg_a_score: 40,
    avg_b_score: 35,
    max_smokescreen_index: null,
    top_smokescreen_pair: null,
    week_attention_budget: 5,
    total_sources: 50,
    primary_doc_count: 3,
    weekly_summary: null,
    editors_pick_event_id: null,
    created_at: '2025-01-05T00:00:00Z',
    ...overrides,
  };
}

describe('SmokescreenAlert', () => {
  it('renders nothing when max_smokescreen_index is null', () => {
    const { container } = render(
      <SmokescreenAlert snapshot={makeSnapshot({ max_smokescreen_index: null })} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when max_smokescreen_index < 25', () => {
    const { container } = render(
      <SmokescreenAlert snapshot={makeSnapshot({ max_smokescreen_index: 20 })} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders SIGNIFICANT for SI 25-50', () => {
    render(
      <SmokescreenAlert
        snapshot={makeSnapshot({
          max_smokescreen_index: 35,
          top_smokescreen_pair: 'Tweet storm ↔ DOJ firing',
        })}
      />
    );
    expect(screen.getByText(/SIGNIFICANT/)).toBeInTheDocument();
    expect(screen.getByText(/Tweet storm/)).toBeInTheDocument();
  });

  it('renders CRITICAL for SI > 50', () => {
    render(
      <SmokescreenAlert
        snapshot={makeSnapshot({
          max_smokescreen_index: 65,
          top_smokescreen_pair: 'Twitter meltdown ↔ Agency purge',
        })}
      />
    );
    expect(screen.getByText(/CRITICAL/)).toBeInTheDocument();
  });

  it('shows fallback text when no pair description', () => {
    render(
      <SmokescreenAlert
        snapshot={makeSnapshot({
          max_smokescreen_index: 40,
          top_smokescreen_pair: null,
        })}
      />
    );
    expect(screen.getByText(/Active pairing detected/)).toBeInTheDocument();
  });
});
