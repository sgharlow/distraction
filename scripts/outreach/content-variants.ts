/**
 * Generate varied post content for 3x/day posting.
 * Each time slot gets a different angle to avoid repetitive spam.
 *
 * Morning (6-8am EST):  Weekly summary / top constitutional damage
 * Midday (12-2pm EST):  Individual event spotlight / smokescreen alert
 * Evening (5-8pm EST):  Undercovered event / historical trend / call to action
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

export type PostSlot = 'morning' | 'midday' | 'evening';

interface PostContent {
  text: string;
  slot: PostSlot;
  variant: string;
}

async function getLatestWeekWithData(): Promise<string> {
  const { data: weeks } = await supabase
    .from('weekly_snapshots')
    .select('week_id, status')
    .order('week_id', { ascending: false })
    .limit(10);

  if (!weeks) throw new Error('No weeks found');

  for (const week of weeks) {
    const { data: events } = await supabase
      .from('events')
      .select('id')
      .eq('week_id', week.week_id)
      .not('a_score', 'is', null)
      .limit(1);
    if (events && events.length > 0) return week.week_id;
  }
  throw new Error('No weeks with scored events');
}

async function getEvents(weekId: string) {
  const { data } = await supabase
    .from('events')
    .select('id, title, a_score, b_score, primary_list, summary, topic_tags, dominance_margin')
    .eq('week_id', weekId)
    .not('a_score', 'is', null)
    .order('a_score', { ascending: false });
  return data || [];
}

async function getSmokescreenPairs(weekId: string) {
  const { data } = await supabase
    .from('smokescreen_pairs')
    .select('distraction_event_id, damage_event_id')
    .eq('week_id', weekId)
    .limit(5);
  return data || [];
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function generatePost(slot: PostSlot): Promise<PostContent> {
  const weekId = await getLatestWeekWithData();
  const events = await getEvents(weekId);
  const listA = events.filter(e => e.primary_list === 'A');
  const listB = events.filter(e => e.primary_list === 'B');

  switch (slot) {
    case 'morning':
      return generateMorningPost(weekId, events, listA, listB);
    case 'midday':
      return generateMiddayPost(weekId, events, listA, listB);
    case 'evening':
      return generateEveningPost(weekId, events, listA, listB);
  }
}

async function generateMorningPost(
  weekId: string, events: any[], listA: any[], listB: any[]
): Promise<PostContent> {
  const variants = [
    // Variant 1: Weekly summary
    () => {
      const topDamage = events[0];
      const topDistraction = [...events].sort((a, b) => b.b_score - a.b_score)[0];
      return {
        text: `This week's Distraction Index (${weekId}):\n\n${events.length} events scored.\n\nHighest constitutional damage: "${topDamage.title}" (${topDamage.a_score}/100)\n\nTop distraction: "${topDistraction.title}" (${topDistraction.b_score}/100)\n\nFull report: https://distractionindex.org/week/${weekId}`,
        variant: 'weekly-summary',
      };
    },
    // Variant 2: List A focus
    () => {
      const count = listA.length;
      const top3 = listA.slice(0, 3).map(e => `- ${e.title} (${e.a_score}/100)`).join('\n');
      return {
        text: `${count} events scored as high constitutional damage this week.\n\n${top3}\n\nThese are the events that matter most — and they're often the ones getting the least coverage.\n\nhttps://distractionindex.org/week/${weekId}`,
        variant: 'list-a-focus',
      };
    },
    // Variant 3: Numbers-driven
    () => {
      const avgA = Math.round(events.reduce((s, e) => s + e.a_score, 0) / events.length);
      const avgB = Math.round(events.reduce((s, e) => s + e.b_score, 0) / events.length);
      return {
        text: `Week of ${weekId} by the numbers:\n\n${events.length} political events tracked\nAvg. constitutional damage: ${avgA}/100\nAvg. distraction score: ${avgB}/100\n${listA.length} high-damage events\n${listB.length} high-distraction events\n\nData doesn't lie. https://distractionindex.org/week/${weekId}`,
        variant: 'numbers',
      };
    },
  ];

  const chosen = await pickRandom(variants)();
  return { ...chosen, slot: 'morning' };
}

async function generateMiddayPost(
  weekId: string, events: any[], listA: any[], listB: any[]
): Promise<PostContent> {
  const variants = [
    // Variant 1: Spotlight a single high-damage event
    () => {
      const event = pickRandom(listA.slice(0, 5));
      return {
        text: `Event spotlight: "${event.title}"\n\nConstitutional damage: ${event.a_score}/100\nDistraction score: ${event.b_score}/100\n\n${event.b_score < 30 ? 'Low media attention on this one. That should concern you.' : 'Getting attention, but is it the right kind?'}\n\nhttps://distractionindex.org/event/${event.id}`,
        variant: 'event-spotlight',
      };
    },
    // Variant 2: Smokescreen alert
    () => {
      const highDist = [...events].sort((a, b) => b.b_score - a.b_score)[0];
      const undercovered = listA.find(e => e.b_score < 30) || listA[listA.length - 1];
      return {
        text: `Smokescreen alert:\n\nWhile "${highDist.title}" dominated headlines (distraction: ${highDist.b_score}/100)...\n\n"${undercovered.title}" flew under the radar (damage: ${undercovered.a_score}/100, coverage: ${undercovered.b_score}/100).\n\nThis is the pattern. https://distractionindex.org/smokescreen`,
        variant: 'smokescreen',
      };
    },
    // Variant 3: Question format
    () => {
      const event = pickRandom(listA.slice(0, 3));
      return {
        text: `Did you hear about "${event.title}" this week?\n\nIt scored ${event.a_score}/100 for constitutional damage.\n\nIf not, ask yourself why. The Distraction Index tracks what's being buried.\n\nhttps://distractionindex.org/week/${weekId}`,
        variant: 'question',
      };
    },
  ];

  const chosen = await pickRandom(variants)();
  return { ...chosen, slot: 'midday' };
}

async function generateEveningPost(
  weekId: string, events: any[], listA: any[], listB: any[]
): Promise<PostContent> {
  const variants = [
    // Variant 1: Undercovered events
    () => {
      const undercovered = listA.filter(e => e.b_score < 35).slice(0, 3);
      if (undercovered.length === 0) {
        return {
          text: `Every week, the Distraction Index scores political events on two axes:\n\n1. How much constitutional damage they cause\n2. How much they serve as distractions\n\nWhen damage is high but coverage is low, that's a red flag.\n\nhttps://distractionindex.org/undercovered`,
          variant: 'methodology',
        };
      }
      const items = undercovered.map(e => `- ${e.title} (damage: ${e.a_score}, coverage: ${e.b_score})`).join('\n');
      return {
        text: `Undercovered this week — high damage, low attention:\n\n${items}\n\nThese events scored high for constitutional harm but got minimal media coverage.\n\nhttps://distractionindex.org/undercovered`,
        variant: 'undercovered',
      };
    },
    // Variant 2: Call to action
    () => {
      return {
        text: `The Distraction Index tracks ${events.length}+ events per week, scoring each for constitutional damage AND media distraction.\n\n59 weeks of data. 1,500+ scored events. Open source. No ads.\n\nBuilt because democracy needs data, not just opinions.\n\nhttps://distractionindex.org\nhttps://distractionindex.org/methodology`,
        variant: 'cta',
      };
    },
    // Variant 3: Topic-based
    () => {
      const topicEvents = events.filter(e => e.topic_tags?.length > 0);
      if (topicEvents.length === 0) {
        return {
          text: `This week in the Distraction Index: ${events.length} events, ${listA.length} high-damage, ${listB.length} high-distraction.\n\nEvery event is dual-scored and source-cited.\n\nhttps://distractionindex.org/week/${weekId}`,
          variant: 'topic-fallback',
        };
      }
      const event = pickRandom(topicEvents);
      const tags = (event.topic_tags || []).slice(0, 3).join(', ');
      return {
        text: `Tracking: ${tags}\n\n"${event.title}" scored ${event.a_score}/100 for constitutional damage this week.\n\nThe Distraction Index monitors ${events.length}+ events weekly across dozens of policy areas.\n\nhttps://distractionindex.org/week/${weekId}`,
        variant: 'topic',
      };
    },
  ];

    // Variant: Historical evergreen stat
    () => {
      return {
        text: `In 60+ weeks of tracking the Distraction Index, we've scored 1,500+ political events on two axes:\n\n🔴 Constitutional damage (real governance harm)\n🟠 Distraction/Hype (media amplification)\n\nWhen damage is high but coverage is low — that's the pattern we exist to expose.\n\nhttps://distractionindex.org`,
        variant: 'evergreen-mission',
      };
    },
    // Variant: Blog post promotion
    async () => {
      const { data: latest } = await supabase
        .from('blog_posts')
        .select('slug, title, week_id')
        .order('published_at', { ascending: false })
        .limit(1)
        .single();
      if (latest) {
        return {
          text: `New analysis: "${latest.title}"\n\nData-driven breakdown of this week's democratic damage vs. manufactured distractions.\n\nRead: https://distractionindex.org/blog/${latest.slug}`,
          variant: 'blog-promo',
        };
      }
      return {
        text: `Every week, the Distraction Index publishes a frozen, immutable record of U.S. political events — scored for both constitutional damage AND media hype.\n\n59+ weeks. Open source. No editorial spin.\n\nhttps://distractionindex.org`,
        variant: 'evergreen-record',
      };
    },
  ];

  const chosen = await pickRandom(variants)();
  return { ...chosen, slot: 'evening' };
}

// CLI test
if (require.main === module) {
  const slot = (process.argv[2] as PostSlot) || 'morning';
  if (!['morning', 'midday', 'evening'].includes(slot)) {
    console.log('Usage: npx tsx content-variants.ts [morning|midday|evening]');
    process.exit(1);
  }
  generatePost(slot).then(post => {
    console.log(`=== ${post.slot.toUpperCase()} (${post.variant}) ===\n`);
    console.log(post.text);
    console.log(`\n--- ${post.text.length} chars ---`);
  }).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}
