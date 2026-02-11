import Link from 'next/link';
import { TopNav } from '@/components/TopNav';
import { DualScore } from '@/components/DualScore';
import { MechanismBadge } from '@/components/MechanismBadge';
import { getEventsByTopic } from '@/lib/data/topics';
import { parseWeekId, getWeekNumber, getWeekLabelShort } from '@/lib/weeks';

interface TopicPageProps {
  params: Promise<{ tag: string }>;
}

export async function generateMetadata({ params }: TopicPageProps) {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  return {
    title: `#${decoded} — The Distraction Index`,
    description: `All events tagged with #${decoded} across all weeks.`,
  };
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  const events = await getEventsByTopic(decoded);

  // Compute aggregate stats
  const listA = events.filter((e) => e.primary_list === 'A').length;
  const listB = events.filter((e) => e.primary_list === 'B').length;
  const listC = events.filter((e) => e.primary_list === 'C').length;
  const avgA = events.length > 0
    ? events.reduce((sum, e) => sum + (e.a_score ?? 0), 0) / events.length
    : 0;
  const avgB = events.length > 0
    ? events.reduce((sum, e) => sum + (e.b_score ?? 0), 0) / events.length
    : 0;

  // Group by week
  const weekGroups = new Map<string, typeof events>();
  for (const event of events) {
    const group = weekGroups.get(event.week_id) ?? [];
    group.push(event);
    weekGroups.set(event.week_id, group);
  }
  const sortedWeeks = Array.from(weekGroups.entries()).sort(
    (a, b) => b[0].localeCompare(a[0])
  );

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="max-w-[860px] mx-auto px-4 py-6">
        <div className="mb-4">
          <h1 className="text-lg font-extrabold text-text-primary font-serif mb-0.5">
            #{decoded}
          </h1>
          <p className="text-[11px] text-text-muted m-0">
            {events.length} event{events.length !== 1 ? 's' : ''} across {weekGroups.size} week{weekGroups.size !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Aggregate stats */}
        {events.length > 0 && (
          <div className="flex gap-3 mb-4 flex-wrap">
            <StatChip label="Damage" value={listA} color="damage" />
            <StatChip label="Distraction" value={listB} color="distraction" />
            <StatChip label="Noise" value={listC} color="noise" />
            <StatChip label="Avg A" value={avgA.toFixed(1)} />
            <StatChip label="Avg B" value={avgB.toFixed(1)} />
          </div>
        )}

        {events.length === 0 ? (
          <p className="text-text-dim text-xs">No events found with this topic tag.</p>
        ) : (
          <div className="space-y-4">
            {sortedWeeks.map(([weekId, weekEvents]) => {
              const weekStart = parseWeekId(weekId);
              const weekNum = getWeekNumber(weekStart);
              const weekLabel = getWeekLabelShort(weekStart);

              return (
                <div key={weekId}>
                  <Link
                    href={`/week/${weekId}`}
                    className="flex items-center gap-2 mb-1.5 no-underline group"
                  >
                    <span className="text-[10px] font-bold tracking-widest text-text-dim group-hover:text-mixed transition-colors">
                      WEEK {weekNum}
                    </span>
                    <span className="text-[10px] text-text-muted">{weekLabel}</span>
                    <span className="flex-1 border-t border-surface-border" />
                  </Link>

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
                                <span className={`text-[8px] font-bold tracking-widest text-${color}`}>
                                  {event.primary_list === 'A' ? 'DMG' : event.primary_list === 'B' ? 'DIST' : 'NOISE'}
                                </span>
                                <span className="text-[9px] text-text-dim">{event.event_date}</span>
                              </div>
                              <div className="text-[12px] text-text-primary font-semibold leading-tight">
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

function StatChip({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={`text-[10px] font-bold ${color ? `text-${color}` : 'text-text-dim'}`}>
        {value}
      </span>
      <span className="text-[9px] text-text-muted">{label}</span>
    </div>
  );
}
