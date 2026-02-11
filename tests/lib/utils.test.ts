import { describe, it, expect } from 'vitest';
import { cn, fmtScore, listColor } from '@/lib/utils';

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
