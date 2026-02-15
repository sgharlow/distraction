import type { WeeklySnapshot, Event } from '@/lib/types';
import { fmtScore } from '@/lib/utils';

/**
 * Generate a live briefing paragraph for the current week.
 * Returns null when no events exist.
 */
export function generateLiveBriefing({
  snapshot,
  topDamage,
  topDistraction,
}: {
  snapshot: WeeklySnapshot;
  topDamage: Event[];
  topDistraction: Event[];
}): string | null {
  const totalEvents = (snapshot.total_events ?? 0);
  if (totalEvents === 0 && topDamage.length === 0 && topDistraction.length === 0) {
    return null;
  }

  const parts: string[] = [];

  const topA = topDamage[0] ?? null;
  const topB = topDistraction[0] ?? null;

  if (topA && topB) {
    parts.push(
      `This week, "${topA.title}" scored highest for constitutional damage (A: ${fmtScore(topA.a_score)}) while media attention centered on "${topB.title}" (B: ${fmtScore(topB.b_score)}).`,
    );
  } else if (topA) {
    parts.push(
      `This week, "${topA.title}" scored highest for constitutional damage (A: ${fmtScore(topA.a_score)}).`,
    );
  } else if (topB) {
    parts.push(
      `This week, media attention centered on "${topB.title}" (B: ${fmtScore(topB.b_score)}).`,
    );
  }

  // Smokescreen sentence
  const maxSI = snapshot.max_smokescreen_index ?? 0;
  if (maxSI >= 25) {
    const siLabel = maxSI >= 50 ? 'Critical' : 'Significant';
    parts.push(`${siLabel} smokescreen activity detected (SI: ${fmtScore(maxSI, 0)}).`);
  }

  // Stats sentence
  const count = totalEvents;
  const sources = snapshot.total_sources ?? 0;
  if (count > 0) {
    parts.push(`${count} events tracked across ${sources} sources.`);
  }

  return parts.length > 0 ? parts.join(' ') : null;
}
