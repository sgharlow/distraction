/**
 * Fetch current week data from Supabase and generate formatted summaries
 * for social media, email, and contact form outreach.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: 'distraction' } }
);

export interface WeekSummary {
  weekId: string;
  totalEvents: number;
  listA: EventSummary[];  // High constitutional damage
  listB: EventSummary[];  // High distraction
  listC: EventSummary[];  // Mixed
  topDamage: EventSummary | null;
  topDistraction: EventSummary | null;
  smokescreenPairs: number;
}

export interface EventSummary {
  id: string;
  title: string;
  scoreA: number;
  scoreB: number;
  classification: string;
}

export async function getCurrentWeekSummary(): Promise<WeekSummary> {
  // Get the most recent frozen week (more compelling data than live/partial)
  const { data: weeks } = await supabase
    .from('weekly_snapshots')
    .select('week_id, status')
    .order('week_id', { ascending: false })
    .limit(5);

  const frozenWeek = weeks?.find(w => w.status === 'frozen') || weeks?.[0];
  if (!frozenWeek) throw new Error('No weeks found in database');

  const weekId = frozenWeek.week_id;

  // Get events for this week
  const { data: events } = await supabase
    .from('events')
    .select('id, title, a_score, b_score, primary_list')
    .eq('week_id', weekId)
    .not('a_score', 'is', null)
    .order('a_score', { ascending: false });

  if (!events || events.length === 0) {
    throw new Error(`No scored events for week ${weekId}`);
  }

  const listA = events
    .filter(e => e.primary_list === 'A')
    .map(mapEvent);
  const listB = events
    .filter(e => e.primary_list === 'B')
    .map(mapEvent);
  const listC = events
    .filter(e => e.primary_list === 'C')
    .map(mapEvent);

  const sortedByA = [...events].sort((a, b) => (b.a_score ?? 0) - (a.a_score ?? 0));
  const sortedByB = [...events].sort((a, b) => (b.b_score ?? 0) - (a.b_score ?? 0));

  // Get smokescreen pairs count
  const { count: smokescreenPairs } = await supabase
    .from('smokescreen_pairs')
    .select('*', { count: 'exact', head: true })
    .eq('week_id', weekId);

  return {
    weekId,
    totalEvents: events.length,
    listA,
    listB,
    listC,
    topDamage: sortedByA[0] ? mapEvent(sortedByA[0]) : null,
    topDistraction: sortedByB[0] ? mapEvent(sortedByB[0]) : null,
    smokescreenPairs: smokescreenPairs ?? 0,
  };
}

function mapEvent(e: any): EventSummary {
  return {
    id: e.id,
    title: e.title,
    scoreA: e.a_score,
    scoreB: e.b_score,
    classification: e.primary_list,
  };
}

/** Short summary for social media posts (under 300 chars) */
export function formatShortPost(summary: WeekSummary): string {
  const lines: string[] = [];
  lines.push(`This week's Distraction Index (${summary.weekId}):`);
  lines.push(`${summary.totalEvents} events scored.`);

  if (summary.topDamage) {
    lines.push(`Highest constitutional damage: "${summary.topDamage.title}" (${summary.topDamage.scoreA}/100)`);
  }
  if (summary.topDistraction) {
    lines.push(`Top distraction: "${summary.topDistraction.title}" (${summary.topDistraction.scoreB}/100)`);
  }
  if (summary.smokescreenPairs > 0) {
    lines.push(`${summary.smokescreenPairs} smokescreen pairs detected.`);
  }
  lines.push(`See the full report: https://distractionindex.org/week/${summary.weekId}`);

  return lines.join('\n');
}

/** Longer format for email/blog posts */
export function formatLongPost(summary: WeekSummary): string {
  const lines: string[] = [];
  lines.push(`# Weekly Distraction Index: ${summary.weekId}\n`);
  lines.push(`This week, we tracked and scored ${summary.totalEvents} political events on two independent dimensions: constitutional damage (A-score) and distraction/hype (B-score).\n`);

  if (summary.listA.length > 0) {
    lines.push(`## High Constitutional Damage (${summary.listA.length} events)`);
    for (const e of summary.listA.slice(0, 5)) {
      lines.push(`- **${e.title}** — Damage: ${e.scoreA}/100, Distraction: ${e.scoreB}/100`);
    }
    lines.push('');
  }

  if (summary.listB.length > 0) {
    lines.push(`## High Distraction (${summary.listB.length} events)`);
    for (const e of summary.listB.slice(0, 5)) {
      lines.push(`- **${e.title}** — Distraction: ${e.scoreB}/100, Damage: ${e.scoreA}/100`);
    }
    lines.push('');
  }

  if (summary.smokescreenPairs > 0) {
    lines.push(`## Smokescreen Alert`);
    lines.push(`${summary.smokescreenPairs} high-distraction events appear to be covering for high-damage events this week.\n`);
  }

  lines.push(`Full interactive report: https://distractionindex.org/week/${summary.weekId}`);
  lines.push(`Methodology: https://distractionindex.org/methodology`);

  return lines.join('\n');
}

/** Email pitch with fresh data for follow-ups */
export function formatEmailPitch(summary: WeekSummary, recipientName: string, recipientFocus: string): string {
  return `Hi ${recipientName},

I'm following up on my earlier message about The Distraction Index (distractionindex.org) — a civic data tool that scores democratic damage vs. manufactured distractions each week.

This week's data tells a striking story: we tracked ${summary.totalEvents} events.${summary.topDamage ? ` The highest constitutional damage event was "${summary.topDamage.title}" scoring ${summary.topDamage.scoreA}/100.` : ''}${summary.topDistraction ? ` Meanwhile, "${summary.topDistraction.title}" dominated media attention with a distraction score of ${summary.topDistraction.scoreB}/100.` : ''}${summary.smokescreenPairs > 0 ? ` We detected ${summary.smokescreenPairs} smokescreen pairs — high-distraction events appearing to cover for genuine democratic damage.` : ''}

${recipientFocus}

The full interactive report with source citations: https://distractionindex.org/week/${summary.weekId}

Would you be open to checking it out? I think your audience would find this useful.

Best,
Steve
distractionindex.org`;
}

// CLI: run directly to test
if (require.main === module) {
  getCurrentWeekSummary()
    .then(summary => {
      console.log('=== SHORT POST ===\n');
      console.log(formatShortPost(summary));
      console.log('\n=== LONG POST ===\n');
      console.log(formatLongPost(summary));
      console.log('\n=== EMAIL PITCH ===\n');
      console.log(formatEmailPitch(summary, 'Test', 'This data is directly relevant to your coverage of democratic accountability.'));
    })
    .catch(err => {
      console.error('Failed to fetch week summary:', err.message);
      process.exit(1);
    });
}
