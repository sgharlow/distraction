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
