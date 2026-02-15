/**
 * Minimal cn() utility — joins class names, filtering out falsy values.
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Format a number as a fixed-decimal string, or return a fallback.
 */
export function fmtScore(value: number | null | undefined, decimals = 1, fallback = '—'): string {
  if (value == null) return fallback;
  return value.toFixed(decimals);
}

/**
 * Get the list color class prefix for a given list.
 */
export function listColor(list: 'A' | 'B' | 'C'): string {
  switch (list) {
    case 'A': return 'damage';
    case 'B': return 'distraction';
    case 'C': return 'noise';
  }
}

/**
 * Format a week-over-week delta as "+3", "−2", or "—" when data is missing.
 */
export function fmtDelta(
  current: number | null | undefined,
  prior: number | null | undefined,
  decimals = 0,
): string {
  if (current == null || prior == null) return '—';
  const diff = current - prior;
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff.toFixed(decimals)}`;
}

/**
 * Get a human-readable severity label for a score value.
 */
export function getSeverityLabel(score: number | null): string {
  const s = score ?? 0;
  if (s >= 70) return 'Critical';
  if (s >= 50) return 'Significant';
  if (s >= 30) return 'Moderate';
  return 'Low';
}
