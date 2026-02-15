import type { WeeklySnapshot, Event } from '@/lib/types';
import { fmtScore } from '@/lib/utils';

/**
 * Generate a live briefing paragraph for the current week.
 * Editorial-style prose that connects damage to distraction.
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
  const maxSI = snapshot.max_smokescreen_index ?? 0;
  const count = totalEvents;
  const sources = snapshot.total_sources ?? 0;
  const listACount = snapshot.list_a_count ?? 0;
  const listBCount = snapshot.list_b_count ?? 0;

  // Main editorial sentence
  if (topA && topB) {
    const aScore = topA.a_score ?? 0;
    const damageLevel = aScore >= 40 ? 'critical' : 'notable';

    parts.push(
      `While the media fixated on "${topB.title}", the real story was "${topA.title}" \u2014 scoring ${fmtScore(topA.a_score)} for ${damageLevel} constitutional damage.`,
    );
  } else if (topA) {
    const aScore = topA.a_score ?? 0;
    if (aScore >= 40) {
      parts.push(
        `The most urgent story this week: "${topA.title}", scoring a critical ${fmtScore(topA.a_score)} for constitutional damage.`,
      );
    } else {
      parts.push(
        `This week's top damage event: "${topA.title}" (A: ${fmtScore(topA.a_score)}).`,
      );
    }
  } else if (topB) {
    parts.push(
      `Media attention this week centered on "${topB.title}" (B: ${fmtScore(topB.b_score)}) \u2014 but no high-damage events rose to prominence.`,
    );
  }

  // Smokescreen sentence — editorial tone
  if (maxSI >= 50) {
    parts.push(`Critical smokescreen activity detected (SI: ${fmtScore(maxSI, 0)}) \u2014 distraction is actively displacing coverage of real damage.`);
  } else if (maxSI >= 25) {
    parts.push(`Significant smokescreen activity detected (SI: ${fmtScore(maxSI, 0)}).`);
  }

  // Closing context sentence
  if (count > 0) {
    if (listACount <= 5 && listBCount >= 20) {
      parts.push(`That's the distraction pattern: ${count} events tracked this week across ${sources} sources, but only ${listACount} made the damage list while ${listBCount} competed for attention.`);
    } else {
      parts.push(`${count} events tracked across ${sources} sources.`);
    }
  }

  return parts.length > 0 ? parts.join(' ') : null;
}
