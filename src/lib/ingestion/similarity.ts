// ═══════════════════════════════════════════════════════════════
// Token-overlap similarity
// Shared by article dedup and post-clustering event merge
// ═══════════════════════════════════════════════════════════════

/**
 * Token-overlap similarity between two strings (0-1).
 * Splits on whitespace, ignores tokens <= 2 chars, returns
 * intersection / max(|A|, |B|).
 */
export function tokenSimilarity(a: string, b: string): number {
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  if (la === lb) return 1;
  if (la.length === 0 || lb.length === 0) return 0;

  const tokensA = new Set(la.split(/\s+/).filter((t) => t.length > 2));
  const tokensB = new Set(lb.split(/\s+/).filter((t) => t.length > 2));

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let overlap = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap++;
  }

  return overlap / Math.max(tokensA.size, tokensB.size);
}
