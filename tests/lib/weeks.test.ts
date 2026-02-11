import { describe, it, expect } from 'vitest';
import {
  getWeekStart,
  getWeekEnd,
  toWeekId,
  parseWeekId,
  getWeekLabel,
  getWeekLabelShort,
  getWeekNumber,
  getWeekIdForDate,
  FIRST_WEEK_START,
} from '@/lib/weeks';

describe('getWeekStart', () => {
  it('returns Sunday for a Sunday date', () => {
    const sunday = new Date(2025, 0, 5); // Jan 5, 2025 = Sunday
    const result = getWeekStart(sunday);
    expect(result.getDay()).toBe(0); // Sunday
    expect(result.getDate()).toBe(5);
  });

  it('returns the preceding Sunday for a Wednesday', () => {
    const wed = new Date(2025, 0, 8); // Jan 8, 2025 = Wednesday
    const result = getWeekStart(wed);
    expect(result.getDay()).toBe(0);
    expect(result.getDate()).toBe(5);
  });

  it('returns the preceding Sunday for a Saturday', () => {
    const sat = new Date(2025, 0, 11); // Jan 11, 2025 = Saturday
    const result = getWeekStart(sat);
    expect(result.getDay()).toBe(0);
    expect(result.getDate()).toBe(5);
  });

  it('returns the preceding Sunday for a Monday', () => {
    const mon = new Date(2025, 0, 6); // Jan 6, 2025 = Monday
    const result = getWeekStart(mon);
    expect(result.getDay()).toBe(0);
    expect(result.getDate()).toBe(5);
  });

  it('handles month boundary correctly', () => {
    // Feb 1, 2025 is Saturday, preceding Sunday is Jan 26
    const date = new Date(2025, 1, 1);
    const result = getWeekStart(date);
    expect(result.getMonth()).toBe(0); // January
    expect(result.getDate()).toBe(26);
  });
});

describe('getWeekEnd', () => {
  it('returns the Saturday 6 days after Sunday', () => {
    const sunday = new Date(2025, 0, 5);
    const result = getWeekEnd(sunday);
    expect(result.getDay()).toBe(6); // Saturday
    expect(result.getDate()).toBe(11);
  });

  it('handles month boundary', () => {
    const sunday = new Date(2025, 0, 26); // Jan 26
    const result = getWeekEnd(sunday);
    expect(result.getMonth()).toBe(1); // Feb
    expect(result.getDate()).toBe(1);
  });
});

describe('toWeekId', () => {
  it('formats a date as YYYY-MM-DD', () => {
    const date = new Date(2025, 0, 5); // Jan 5
    expect(toWeekId(date)).toBe('2025-01-05');
  });

  it('pads single-digit months and days', () => {
    const date = new Date(2025, 2, 2); // Mar 2
    expect(toWeekId(date)).toBe('2025-03-02');
  });
});

describe('parseWeekId', () => {
  it('parses a YYYY-MM-DD string to a Date', () => {
    const result = parseWeekId('2025-01-05');
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(5);
  });

  it('round-trips with toWeekId', () => {
    const original = new Date(2025, 5, 15);
    const weekId = toWeekId(original);
    const parsed = parseWeekId(weekId);
    expect(parsed.getFullYear()).toBe(2025);
    expect(parsed.getMonth()).toBe(5);
    expect(parsed.getDate()).toBe(15);
  });
});

describe('getWeekLabel', () => {
  it('produces a human-readable range', () => {
    const sunday = new Date(2026, 1, 1); // Feb 1 (Sun) to Feb 7 (Sat)
    const label = getWeekLabel(sunday);
    expect(label).toContain('Feb 1');
    expect(label).toContain('Feb 7');
    expect(label).toContain('2026');
  });
});

describe('getWeekLabelShort', () => {
  it('uses short format within same month', () => {
    const sunday = new Date(2026, 1, 1); // Feb 1-7
    const label = getWeekLabelShort(sunday);
    // Should be "Feb 1 – 7" (same month)
    expect(label).toMatch(/Feb 1/);
    expect(label).toMatch(/7/);
  });

  it('uses month for both sides when crossing months', () => {
    const sunday = new Date(2025, 0, 26); // Jan 26 – Feb 1
    const label = getWeekLabelShort(sunday);
    expect(label).toMatch(/Jan/);
    expect(label).toMatch(/Feb/);
  });
});

describe('getWeekNumber', () => {
  it('returns 1 for FIRST_WEEK_START', () => {
    expect(getWeekNumber(FIRST_WEEK_START)).toBe(1);
  });

  it('returns 2 for the week after FIRST_WEEK_START', () => {
    const nextWeek = new Date(FIRST_WEEK_START);
    nextWeek.setDate(nextWeek.getDate() + 7);
    expect(getWeekNumber(nextWeek)).toBe(2);
  });

  it('increments correctly over multiple weeks', () => {
    const week10 = new Date(FIRST_WEEK_START);
    week10.setDate(week10.getDate() + 63); // 9 weeks later
    expect(getWeekNumber(week10)).toBe(10);
  });
});

describe('getWeekIdForDate', () => {
  it('returns the week_id for a given event date', () => {
    // Jan 8 2025 (Wed) should be in week starting Jan 5
    const result = getWeekIdForDate(new Date(2025, 0, 8));
    expect(result).toBe('2025-01-05');
  });

  it('assigns Sunday to its own week', () => {
    const result = getWeekIdForDate(new Date(2025, 0, 5));
    expect(result).toBe('2025-01-05');
  });

  it('assigns Saturday to the same week as the preceding Sunday', () => {
    const result = getWeekIdForDate(new Date(2025, 0, 11));
    expect(result).toBe('2025-01-05');
  });
});
