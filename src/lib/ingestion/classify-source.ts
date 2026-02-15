// ═══════════════════════════════════════════════════════════════
// Source Type Classification — Domain-based heuristic
// Classifies article URLs into SourceType categories
// ═══════════════════════════════════════════════════════════════

import type { SourceType } from '@/lib/types';

const WIRE_DOMAINS = new Set([
  'reuters.com', 'apnews.com', 'upi.com', 'afp.com',
]);

const NATIONAL_DOMAINS = new Set([
  'nytimes.com', 'washingtonpost.com', 'wsj.com', 'usatoday.com',
  'cnn.com', 'foxnews.com', 'nbcnews.com', 'abcnews.go.com',
  'cbsnews.com', 'bbc.com', 'bbc.co.uk', 'theguardian.com',
  'politico.com', 'thehill.com', 'axios.com', 'npr.org',
]);

const PRIMARY_DOC_PATTERNS = [
  /\.gov($|\/)/,
  /congress\.gov/,
  /supremecourt\.gov/,
  /whitehouse\.gov/,
  /federalregister\.gov/,
  /courtlistener\.com/,
  /law\.cornell\.edu/,
];

/**
 * Classify an article URL into a SourceType based on its domain.
 * Returns null for unrecognized domains rather than guessing.
 */
export function classifySource(url: string, _publisher: string | null): SourceType | null {
  let domain: string;
  try {
    domain = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }

  if (PRIMARY_DOC_PATTERNS.some((p) => p.test(domain))) return 'primary_doc';
  if (WIRE_DOMAINS.has(domain)) return 'wire';
  if (NATIONAL_DOMAINS.has(domain)) return 'national';

  return null;
}
