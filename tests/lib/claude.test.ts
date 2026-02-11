import { describe, it, expect } from 'vitest';
import { extractJSON } from '@/lib/claude';

describe('extractJSON', () => {
  it('parses plain JSON string', () => {
    const result = extractJSON<{ name: string }>('{"name": "test"}');
    expect(result).toEqual({ name: 'test' });
  });

  it('extracts JSON from markdown code fence', () => {
    const text = 'Here is the result:\n```json\n{"score": 42}\n```\nDone.';
    const result = extractJSON<{ score: number }>(text);
    expect(result).toEqual({ score: 42 });
  });

  it('extracts JSON from code fence without json language tag', () => {
    const text = '```\n{"value": true}\n```';
    const result = extractJSON<{ value: boolean }>(text);
    expect(result).toEqual({ value: true });
  });

  it('handles arrays', () => {
    const text = '```json\n[1, 2, 3]\n```';
    const result = extractJSON<number[]>(text);
    expect(result).toEqual([1, 2, 3]);
  });

  it('throws for invalid JSON', () => {
    expect(() => extractJSON('not json')).toThrow();
  });

  it('handles nested objects in markdown fences', () => {
    const text = '```json\n{"a": {"b": {"c": 1}}}\n```';
    const result = extractJSON<{ a: { b: { c: number } } }>(text);
    expect(result.a.b.c).toBe(1);
  });
});
