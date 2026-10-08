import { describe, it, expect } from 'vitest';
import { expectedWeek, evaluateHeartbeat } from '@/lib/monitor/substack-deadman';
import { getWeekNumber, parseWeekId } from '@/lib/weeks';

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


describe('evaluateHeartbeat (SUBSTACK_LAST_PUBLISHED_WEEK written by the verified Sunday publish)', () => {
  it('heartbeat equal to the expected week is OK', () => {
    const v = evaluateHeartbeat('93', 93);
    expect(v.state).toBe('OK');
    expect(v.newest).toBe(93);
    expect(v.expected).toBe(93);
  });

  it('a heartbeat one week ahead (Sunday published, Monday not yet due) is OK', () => {
    expect(evaluateHeartbeat('93', 92).state).toBe('OK');
  });

  it('tolerates surrounding whitespace from the vars context', () => {
    expect(evaluateHeartbeat(' 93\n', 93).state).toBe('OK');
  });

  it('a heartbeat lower than expected is MISSING and names both weeks', () => {
    const v = evaluateHeartbeat('92', 93);
    expect(v.state).toBe('MISSING');
    expect(v.newest).toBe(92);
    expect(v.reason).toContain('Week 92');
    expect(v.reason).toContain('Week 93');
  });

  it('an unset variable (empty string from the vars context) is ERROR, never OK', () => {
    for (const raw of ['', '   ', undefined, null]) {
      const v = evaluateHeartbeat(raw, 93);
      expect(v.state).toBe('ERROR');
      expect(v.newest).toBeNull();
      expect(v.reason).toContain('SUBSTACK_LAST_PUBLISHED_WEEK');
    }
  });

  it('a non-numeric or non-integer heartbeat is ERROR, never OK', () => {
    for (const raw of ['Week 93', '93.5', '-93', 'abc', '0x5d', '1e3', 93 as unknown]) {
      expect(evaluateHeartbeat(raw, 93).state).toBe('ERROR');
    }
  });

  it('week 0 is ERROR', () => {
    expect(evaluateHeartbeat('0', 93).state).toBe('ERROR');
  });

  it('a heartbeat more than one week ahead of the calendar is ERROR (a bad write must not mask months of silence)', () => {
    const v = evaluateHeartbeat('999', 93);
    expect(v.state).toBe('ERROR');
    expect(v.reason).toContain('ahead');
  });

  it('keeps a garbage value out of the one-line reason when it is long', () => {
    const v = evaluateHeartbeat('x'.repeat(500), 93);
    expect(v.state).toBe('ERROR');
    expect(v.reason.length).toBeLessThan(200);
  });
});
