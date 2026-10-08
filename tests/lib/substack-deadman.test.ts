import { describe, it, expect } from 'vitest';
import {
  expectedWeek,
  evaluate,
  weekFromTitle,
  mergeListings,
} from '@/lib/monitor/substack-deadman';
import { getWeekNumber, parseWeekId } from '@/lib/weeks';

// Shapes captured from the live public endpoints on 2026-10-08 ~04:15Z
// (GET /api/v1/archive?sort=new&limit=5 — still lagging at Week 63 while
// /api/v1/posts already listed Week 92). Fields trimmed to the ones read.
const WEEK_63 = {
  title: 'Week 63: A 100/100 Damage Score — and Nobody Noticed',
  post_date: '2026-03-17T04:43:57.240Z',
  audience: 'everyone',
};
const COMING_SOON = { title: 'Coming soon', post_date: '2026-03-17T04:39:02.716Z', audience: 'everyone' };
const WEEK_92 = {
  title: 'Week 92: The Mail-In Voting Bombshell Buried Under Mosquito Control Theater',
  post_date: '2026-10-08T04:08:40.421Z',
  audience: 'everyone',
};

describe('expectedWeek', () => {
  it('Mon 2026-10-12 15:00Z expects Week 93 (the week that froze Sun 10-11)', () => {
    expect(expectedWeek(new Date('2026-10-12T15:00:00Z'))).toBe(93);
  });

  it('Mon 2026-10-05 15:00Z expects Week 92', () => {
    expect(expectedWeek(new Date('2026-10-05T15:00:00Z'))).toBe(92);
  });

  it('Sun 2026-10-11 03:00Z (before that Sunday\'s 09:00Z run) still expects Week 92', () => {
    expect(expectedWeek(new Date('2026-10-11T03:00:00Z'))).toBe(92);
  });

  it('does not expect a Sunday run until 24h after it (boundary is Mon 09:00Z)', () => {
    expect(expectedWeek(new Date('2026-10-12T08:59:59Z'))).toBe(92);
    expect(expectedWeek(new Date('2026-10-12T09:00:00Z'))).toBe(93);
  });

  it('a late-delivered Tuesday re-check expects the same week as Monday', () => {
    expect(expectedWeek(new Date('2026-10-13T21:00:00Z'))).toBe(93);
  });

  it('agrees with src/lib/weeks getWeekNumber (the site\'s own numbering) for the week it expects', () => {
    // The Monday after week W ends is weekStart(W) + 8 days; check a year of weeks.
    for (let w = 1; w <= 52 * 2; w++) {
      const weekStart = new Date(Date.UTC(2024, 11, 29) + (w - 1) * 7 * 86_400_000);
      const weekId = weekStart.toISOString().slice(0, 10);
      const monday = new Date(weekStart.getTime() + 8 * 86_400_000 + 15 * 3_600_000);
      expect(expectedWeek(monday)).toBe(getWeekNumber(parseWeekId(weekId)));
    }
  });

  it('refuses a clock before Week 1 could have been published', () => {
    expect(() => expectedWeek(new Date('2025-01-01T00:00:00Z'))).toThrow(RangeError);
  });

  it('refuses an invalid date rather than guessing', () => {
    expect(() => expectedWeek(new Date('not a date'))).toThrow(RangeError);
  });
});

describe('weekFromTitle', () => {
  it('parses "Week N:" titles and ignores everything else', () => {
    expect(weekFromTitle(WEEK_92.title)).toBe(92);
    expect(weekFromTitle('Coming soon')).toBeNull();
    expect(weekFromTitle(undefined)).toBeNull();
    expect(weekFromTitle(42)).toBeNull();
  });
});

describe('evaluate', () => {
  it('tonight\'s lagging archive [Week 63, Coming soon] with Week 92 expected is MISSING', () => {
    const v = evaluate([WEEK_63, COMING_SOON], 92);
    expect(v.state).toBe('MISSING');
    expect(v.newest).toBe(63);
    expect(v.expected).toBe(92);
    expect(v.reason).toContain('Week 63');
  });

  it('is OK when Week 92 is present', () => {
    const v = evaluate([WEEK_92, WEEK_63, COMING_SOON], 92);
    expect(v.state).toBe('OK');
    expect(v.newest).toBe(92);
  });

  it('is OK when a later week than expected is present', () => {
    expect(evaluate([WEEK_92], 91).state).toBe('OK');
  });

  it('an empty archive is ERROR, never OK', () => {
    const v = evaluate([], 92);
    expect(v.state).toBe('ERROR');
    expect(v.newest).toBeNull();
  });

  it('an archive with no parseable "Week N" title is ERROR, never OK', () => {
    expect(evaluate([COMING_SOON], 92).state).toBe('ERROR');
  });

  it('a non-array body (API shape change) is ERROR, never OK', () => {
    expect(evaluate({ posts: [WEEK_92] }, 92).state).toBe('ERROR');
    expect(evaluate(null, 92).state).toBe('ERROR');
  });
});

describe('mergeListings', () => {
  it('unions the lagging archive with the fresh posts listing so a lag alone does not alert', () => {
    const merged = mergeListings([
      { source: 'archive', body: [WEEK_63, COMING_SOON] },
      { source: 'posts', body: [WEEK_92, WEEK_63] },
    ]);
    expect(merged.errors).toEqual([]);
    expect(evaluate(merged.items, 92).state).toBe('OK');
  });

  it('records a failed or mis-shaped source as an error and keeps the other', () => {
    const merged = mergeListings([
      { source: 'archive', error: 'HTTP 503' },
      { source: 'posts', body: { not: 'an array' } },
    ]);
    expect(merged.items).toEqual([]);
    expect(merged.errors).toEqual(['archive: HTTP 503', 'posts: response is not an array']);
    expect(evaluate(merged.items, 92).state).toBe('ERROR');
  });
});
