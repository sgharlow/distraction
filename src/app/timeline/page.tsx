import type { Metadata } from 'next';
import Link from 'next/link';
import { TopNav } from '@/components/TopNav';
import { DualScore } from '@/components/DualScore';
import { MechanismBadge } from '@/components/MechanismBadge';
import { getAllEvents } from '@/lib/data/timeline';
import { parseWeekId, getWeekNumber, getWeekLabelShort } from '@/lib/weeks';

interface TimelinePageProps {
  searchParams: Promise<{ list?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Timeline',
    description: 'Chronological view of all scored events across all weeks of The Distraction Index.',
    openGraph: {
      title: 'Timeline',
      description: 'Chronological view of all scored events across all weeks. Damage, distraction, and noise — tracked over time.',
      url: '/timeline',
    },
    twitter: {
      card: 'summary',
      title: 'Timeline | The Distraction Index',
      description: 'Chronological view of all scored events across all weeks.',
    },
    alternates: {
      canonical: '/timeline',
    },
  };
}

export default async function TimelinePage({ searchParams }: TimelinePageProps) {
  const sp = await searchParams;
  const listFilter = sp.list?.toUpperCase() as 'A' | 'B' | 'C' | undefined;

  const events = await getAllEvents(listFilter);

  // Group events by week_id
  const weekGroups = new Map<string, typeof events>();
  for (const event of events) {
    const group = weekGroups.get(event.week_id) ?? [];
    group.push(event);
    weekGroups.set(event.week_id, group);
  }

  // Sort weeks newest first
  const sortedWeeks = Array.from(weekGroups.entries()).sort(
    (a, b) => b[0].localeCompare(a[0])
  );

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="max-w-[860px] mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-extrabold text-text-primary font-serif mb-0.5">
              Timeline
            </h1>
            <p className="text-[13px] text-text-muted m-0">
              All scored events across all weeks, newest first.
            </p>
          </div>
        </div>

        {/* List filter */}
        <div className="flex gap-1 mb-4">
          <FilterChip href="/timeline" label="All" active={!listFilter} />
          <FilterChip href="/timeline?list=A" label="Damage" active={listFilter === 'A'} color="damage" />
          <FilterChip href="/timeline?list=B" label="Distraction" active={listFilter === 'B'} color="distraction" />
          <FilterChip href="/timeline?list=C" label="Noise" active={listFilter === 'C'} color="noise" />
        </div>

        {sortedWeeks.length === 0 ? (
          <p className="text-text-dim text-sm">No events found.</p>
        ) : (
          <div className="space-y-4">
            {sortedWeeks.map(([weekId, weekEvents]) => {
              const weekStart = parseWeekId(weekId);
              const weekNum = getWeekNumber(weekStart);
              const weekLabel = getWeekLabelShort(weekStart);

              return (
                <div key={weekId}>
                  {/* Week header */}
                  <Link
                    href={`/week/${weekId}`}
                    className="flex items-center gap-2 mb-1.5 no-underline group"
                  >
                    <span className="text-[12px] font-bold tracking-widest text-text-dim group-hover:text-mixed transition-colors">
                      WEEK {weekNum}
                    </span>
                    <span className="text-[12px] text-text-muted">
                      {weekLabel}
                    </span>
                    <span className="flex-1 border-t border-surface-border" />
                    <span className="text-[11px] text-text-dim">
                      {weekEvents.length} events
                    </span>
                  </Link>

                  {/* Events */}
                  <div className="space-y-1">
                    {weekEvents.map((event) => {
                      const color = event.primary_list === 'A' ? 'damage' : event.primary_list === 'B' ? 'distraction' : 'noise';
                      return (
                        <Link
                          key={event.id}
                          href={`/event/${event.id}`}
                          className={`block bg-${color}/[0.02] border border-${color}/[0.06] rounded-md p-2.5 no-underline hover:border-${color}/15 transition-colors`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className={`text-[10px] font-bold tracking-widest text-${color}`}>
                                  {event.primary_list === 'A' ? 'DMG' : event.primary_list === 'B' ? 'DIST' : 'NOISE'}
                                </span>
                                <span className="text-[11px] text-text-dim">
                                  {event.event_date}
                                </span>
                              </div>
                              <div className="text-sm text-text-primary font-semibold leading-tight">
                                {event.title}
                              </div>
                              <MechanismBadge
                                mechanism={event.mechanism_of_harm}
                                scope={event.scope}
                                affectedPopulation={event.affected_population}
                              />
                            </div>
                            <div className="text-right min-w-[80px] shrink-0">
                              <DualScore aScore={event.a_score} bScore={event.b_score} />
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function FilterChip({ href, label, active, color }: { href: string; label: string; active: boolean; color?: string }) {
  const activeClass = active
    ? color
      ? `bg-${color}/10 border-${color}/20 text-${color}`
      : 'bg-white/10 border-white/20 text-text-primary'
    : 'border-surface-border text-text-dim hover:text-text-muted';

  return (
    <Link
      href={href}
      className={`px-2.5 py-1 rounded-full border text-[12px] font-semibold no-underline transition-colors ${activeClass}`}
    >
      {label}
    </Link>
  );
}
