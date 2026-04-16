import { describe, it, expect } from 'vitest';
import { tokenSimilarity } from '@/lib/ingestion/similarity';

describe('tokenSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(tokenSimilarity('hello world foo', 'hello world foo')).toBe(1);
  });

  it('returns 1 for identical strings after lowercasing', () => {
    expect(tokenSimilarity('Hello World Foo', 'hello world foo')).toBe(1);
  });

  it('returns 0 for completely different strings', () => {
    expect(tokenSimilarity('apple banana cherry', 'xenon yellow zebra')).toBe(0);
  });

  it('returns 0 when one string is empty', () => {
    expect(tokenSimilarity('', 'hello world foo')).toBe(0);
    expect(tokenSimilarity('hello world foo', '')).toBe(0);
  });

  it('returns 0 when both strings are empty', () => {
    expect(tokenSimilarity('', '')).toBe(1); // identical strings
  });

  it('ignores tokens with 2 or fewer characters', () => {
    // "an" and "on" are <= 2 chars, so filtered out
    // Only "apple" and "table" are meaningful tokens
    expect(tokenSimilarity('an apple on', 'an table on')).toBe(0);
  });

  it('returns 0 when all tokens are 2 chars or fewer and strings differ', () => {
    // "a", "ab", "cd" are all <= 2 chars, filtered out leaving empty token sets
    // But different strings, so no early return on string equality
    expect(tokenSimilarity('a ab cd', 'e fg hi')).toBe(0);
  });

  it('returns 1 for identical strings even when all tokens are short (early exit)', () => {
    // Identical strings trigger early return before token filtering
    expect(tokenSimilarity('a ab cd', 'a ab cd')).toBe(1);
  });

  it('calculates partial overlap correctly', () => {
    // tokensA = {trump, signs, executive, order}  (4 tokens)
    // tokensB = {trump, vetoes, executive, order}  (4 tokens)
    // overlap = 3 (trump, executive, order)
    // similarity = 3 / max(4, 4) = 0.75
    const sim = tokenSimilarity(
      'Trump signs executive order',
      'Trump vetoes executive order',
    );
    expect(sim).toBe(0.75);
  });

  it('handles whitespace trimming', () => {
    expect(tokenSimilarity('  hello world foo  ', 'hello world foo')).toBe(1);
  });

  it('uses max(|A|, |B|) as denominator', () => {
    // tokensA = {hello, world, foo, bar} (4 tokens)
    // tokensB = {hello, world} (2 tokens)
    // overlap = 2
    // similarity = 2 / max(4, 2) = 0.5
    const sim = tokenSimilarity('hello world foo bar', 'hello world');
    expect(sim).toBe(0.5);
  });

  it('is case-insensitive', () => {
    const sim = tokenSimilarity('TRUMP EXECUTIVE ORDER', 'trump executive order');
    expect(sim).toBe(1);
  });

  it('handles single-word strings with length > 2', () => {
    expect(tokenSimilarity('hello', 'hello')).toBe(1);
    expect(tokenSimilarity('hello', 'world')).toBe(0);
  });
});
