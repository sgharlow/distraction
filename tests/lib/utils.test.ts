import { describe, it, expect } from 'vitest';
import { cn, fmtScore, fmtDelta, listColor, getSeverityLabel } from '@/lib/utils';

describe('cn (class names utility)', () => {
  it('joins multiple class names', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
  });

  it('filters out false values', () => {
    expect(cn('foo', false, 'bar')).toBe('foo bar');
  });

  it('filters out null values', () => {
    expect(cn('foo', null, 'bar')).toBe('foo bar');
  });

  it('filters out undefined values', () => {
    expect(cn('foo', undefined, 'bar')).toBe('foo bar');
  });

  it('filters out empty strings', () => {
    expect(cn('foo', '', 'bar')).toBe('foo bar');
  });

  it('returns empty string when all inputs are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('handles a single class name', () => {
    expect(cn('only')).toBe('only');
  });
});

describe('fmtScore', () => {
  it('formats a number with default 1 decimal', () => {
    expect(fmtScore(42.5)).toBe('42.5');
  });

  it('formats a number with specified decimals', () => {
    expect(fmtScore(42.567, 2)).toBe('42.57');
  });

  it('returns fallback for null', () => {
    expect(fmtScore(null)).toBe('—');
  });

  it('returns fallback for undefined', () => {
    expect(fmtScore(undefined)).toBe('—');
  });

  it('uses custom fallback', () => {
    expect(fmtScore(null, 1, 'N/A')).toBe('N/A');
  });

  it('formats zero correctly', () => {
    expect(fmtScore(0)).toBe('0.0');
  });

  it('formats 100 correctly', () => {
    expect(fmtScore(100)).toBe('100.0');
  });

  it('handles negative numbers', () => {
    expect(fmtScore(-5.7)).toBe('-5.7');
  });
});

describe('fmtDelta', () => {
  it('formats positive delta with + sign', () => {
    expect(fmtDelta(10, 7)).toBe('+3');
  });

  it('formats negative delta without extra sign', () => {
    expect(fmtDelta(5, 8)).toBe('-3');
  });

  it('formats zero delta as 0', () => {
    expect(fmtDelta(5, 5)).toBe('0');
  });

  it('returns — when current is null', () => {
    expect(fmtDelta(null, 5)).toBe('—');
  });

  it('returns — when prior is null', () => {
    expect(fmtDelta(5, null)).toBe('—');
  });

  it('returns — when both are null', () => {
    expect(fmtDelta(null, null)).toBe('—');
  });

  it('returns — when current is undefined', () => {
    expect(fmtDelta(undefined, 5)).toBe('—');
  });

  it('respects decimal parameter', () => {
    expect(fmtDelta(10.5, 7.2, 1)).toBe('+3.3');
  });
});

describe('listColor', () => {
  it('returns "damage" for List A', () => {
    expect(listColor('A')).toBe('damage');
  });

  it('returns "distraction" for List B', () => {
    expect(listColor('B')).toBe('distraction');
  });

  it('returns "noise" for List C', () => {
    expect(listColor('C')).toBe('noise');
  });
});

describe('getSeverityLabel', () => {
  it('returns "Critical" for scores >= 70', () => {
    expect(getSeverityLabel(70)).toBe('Critical');
    expect(getSeverityLabel(85)).toBe('Critical');
    expect(getSeverityLabel(100)).toBe('Critical');
  });

  it('returns "Significant" for scores >= 50 and < 70', () => {
    expect(getSeverityLabel(50)).toBe('Significant');
    expect(getSeverityLabel(65)).toBe('Significant');
  });

  it('returns "Moderate" for scores >= 30 and < 50', () => {
    expect(getSeverityLabel(30)).toBe('Moderate');
    expect(getSeverityLabel(45)).toBe('Moderate');
  });

  it('returns "Low" for scores < 30', () => {
    expect(getSeverityLabel(0)).toBe('Low');
    expect(getSeverityLabel(29)).toBe('Low');
  });

  it('treats null as 0 (Low)', () => {
    expect(getSeverityLabel(null)).toBe('Low');
  });
});
