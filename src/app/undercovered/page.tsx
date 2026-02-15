import type { Metadata } from 'next';
import Link from 'next/link';
import { TopNav } from '@/components/TopNav';
import { DualScore } from '@/components/DualScore';
import { AttentionBudget } from '@/components/AttentionBudget';
import { MechanismBadge } from '@/components/MechanismBadge';
import { ActionItem } from '@/components/ActionItem';
import { resolveWeekParam, toWeekId, getWeekLabel, getWeekNumber, isCurrentWeek } from '@/lib/weeks';
import { getWeekData, getAllWeekSnapshots } from '@/lib/data/weeks';

interface UndercoveredPageProps {
  searchParams: Promise<{ week?: string }>;
}

export async function generateMetadata({ searchParams }: UndercoveredPageProps): Promise<Metadata> {
  const sp = await searchParams;
  const weekStart = resolveWeekParam(sp.week ?? 'current');
  if (!weekStart) return { title: 'Undercovered' };

  const weekNum = getWeekNumber(weekStart);
  const description = `Week ${weekNum} Undercovered: high constitutional damage events receiving disproportionately low media attention.`;

  return {
    title: `Undercovered — Week ${weekNum}`,
    description,
    openGraph: {
      title: `Undercovered — Week ${weekNum}`,
      description,
      url: '/undercovered',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Undercovered — Week ${weekNum} | The Distraction Index`,
      description,
    },
    alternates: {
      canonical: '/undercovered',
    },
  };
}

export default async function UndercoveredPage({ searchParams }: UndercoveredPageProps) {
  const sp = await searchParams;
  const weekStart = resolveWeekParam(sp.week ?? 'current');
  if (!weekStart) {
    return (
      <div className="min-h-screen">
        <TopNav />
        <main className="max-w-[780px] mx-auto px-4 py-6">
          <p className="text-text-dim text-sm">Invalid week.</p>
        </main>
      </div>
    );
  }

  const weekId = toWeekId(weekStart);
  const live = isCurrentWeek(weekStart);
  const weekData = await getWeekData(weekId);
  const allWeeks = await getAllWeekSnapshots();

  const prevWeek = allWeeks.find((w) => w.week_id < weekId);
  const nextWeek = live ? null : allWeeks.find((w) => w.week_id > weekId);

  const allListA = (weekData?.events.A ?? []).sort((a, b) => {
    const abA = (a.b_score ?? 0) - (a.a_score ?? 0);
    const abB = (b.b_score ?? 0) - (b.a_score ?? 0);
    return abA - abB;
  });

  const undercovered = allListA.filter((e) => {
    const ab = (e.b_score ?? 0) - (e.a_score ?? 0);
    return ab < -15;
  });

  const otherListA = allListA.filter((e) => {
    const ab = (e.b_score ?? 0) - (e.a_score ?? 0);
    return ab >= -15;
  });

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="max-w-[780px] mx-auto px-4 py-6">
        {/* Week nav */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-extrabold text-text-primary font-serif mb-0.5">
              Undercovered High-Damage
            </h1>
            <p className="text-[13px] text-text-muted m-0">
              Week {getWeekNumber(weekStart)}: {getWeekLabel(weekStart)}
              {live ? ' · 🟢 LIVE' : ' · 🔒 FROZEN'}
            </p>
          </div>
          <div className="flex gap-1">
            {prevWeek ? (
              <Link
                href={`/undercovered?week=${prevWeek.week_id}`}
                className="px-2 py-1 rounded border border-surface-border bg-white/[0.04] text-[12.5px] font-semibold text-text-muted hover:text-mixed hover:border-mixed/25 transition-colors no-underline"
              >
                ◀ Prev
              </Link>
            ) : (
              <span className="px-2 py-1 rounded border border-surface-border text-[12.5px] font-semibold text-text-dim/30">◀ Prev</span>
            )}
            {nextWeek ? (
              <Link
                href={`/undercovered?week=${nextWeek.week_id}`}
                className="px-2 py-1 rounded border border-surface-border bg-white/[0.04] text-[12.5px] font-semibold text-text-muted hover:text-mixed hover:border-mixed/25 transition-colors no-underline"
              >
                Next ▶
              </Link>
            ) : (
              <span className="px-2 py-1 rounded border border-surface-border text-[12.5px] font-semibold text-text-dim/30">Next ▶</span>
            )}
          </div>
        </div>

        <p className="text-[13.5px] text-text-muted mb-4 leading-relaxed">
          These are events where constitutional damage (A-score) far exceeds
          the media attention they receive (B-score). An Attention Budget below
          −15 means the event is getting less coverage than its real-world
          impact warrants — the public should know more about these.
        </p>

        {/* Tier 1: Undercovered (AB < -15) — highlighted */}
        {undercovered.length > 0 && (
          <div className="space-y-1.5 mb-4">
            <div className="text-[11.5px] font-bold uppercase tracking-widest text-damage mb-1">
              Undercovered ({undercovered.length})
            </div>
            {undercovered.map((event) => (
              <Link
                key={event.id}
                href={`/event/${event.id}`}
                className="block bg-damage/[0.03] border border-damage/[0.08] rounded-lg p-3 no-underline hover:border-damage/20 transition-colors"
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="text-[15px] text-text-primary font-bold">{event.title}</div>
                    <MechanismBadge
                      mechanism={event.mechanism_of_harm}
                      scope={event.scope}
                      affectedPopulation={event.affected_population}
                    />
                  </div>
                  <div className="text-right min-w-[90px]">
                    <DualScore aScore={event.a_score} bScore={event.b_score} />
                    <div className="mt-1">
                      <AttentionBudget aScore={event.a_score} bScore={event.b_score} />
                    </div>
                  </div>
                </div>
                {event.action_item && (
                  <div className="mt-1.5">
                    <ActionItem text={event.action_item} />
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}

        {/* Tier 2: All other List A events — muted style */}
        {otherListA.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11.5px] font-bold uppercase tracking-widest text-text-dim mb-1">
              All List A Events ({otherListA.length})
            </div>
            {otherListA.map((event) => (
              <Link
                key={event.id}
                href={`/event/${event.id}`}
                className="block bg-white/[0.02] border border-surface-border rounded-lg p-3 no-underline hover:border-damage/15 transition-colors"
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="text-[15px] text-text-secondary font-semibold">{event.title}</div>
                    <MechanismBadge
                      mechanism={event.mechanism_of_harm}
                      scope={event.scope}
                      affectedPopulation={event.affected_population}
                    />
                  </div>
                  <div className="text-right min-w-[90px]">
                    <DualScore aScore={event.a_score} bScore={event.b_score} />
                    <div className="mt-1">
                      <AttentionBudget aScore={event.a_score} bScore={event.b_score} />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Empty state — only when no List A events at all */}
        {undercovered.length === 0 && otherListA.length === 0 && (
          <div className="bg-surface-raised border border-surface-border rounded-lg p-5 text-center">
            <div className="text-[12px] font-bold uppercase tracking-widest text-text-muted mb-1.5">
              No List A Events
            </div>
            <p className="text-[13.5px] text-text-dim leading-relaxed m-0 mb-2">
              No high-damage events have been scored this week yet.
              Check back as the week progresses.
            </p>
            <Link
              href="/week/current"
              className="text-[12.5px] text-mixed hover:underline no-underline"
            >
              Back to Dashboard
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
