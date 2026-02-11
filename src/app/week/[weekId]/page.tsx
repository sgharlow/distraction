import { resolveWeekParam, getWeekLabel, getWeekNumber, isCurrentWeek, toWeekId } from '@/lib/weeks';
import { getWeekData } from '@/lib/data/weeks';
import { getAllWeekSnapshots } from '@/lib/data/weeks';
import { notFound } from 'next/navigation';

import { TopNav } from '@/components/TopNav';
import { WeekSelector } from '@/components/WeekSelector';
import { WeekStatsBar } from '@/components/WeekStatsBar';
import { WeekSummary } from '@/components/WeekSummary';
import { SmokescreenAlert } from '@/components/SmokescreenAlert';
import { NarrativeStrips } from '@/components/NarrativeStrips';
import { ListColumn } from '@/components/ListColumn';

interface WeekPageProps {
  params: Promise<{ weekId: string }>;
}

export async function generateMetadata({ params }: WeekPageProps) {
  const { weekId } = await params;
  const weekStart = resolveWeekParam(weekId);
  if (!weekStart) return { title: 'Week Not Found' };

  const label = getWeekLabel(weekStart);
  const weekNum = getWeekNumber(weekStart);
  const live = isCurrentWeek(weekStart);

  return {
    title: `Week ${weekNum}: ${label}${live ? ' (Live)' : ''}`,
    description: `The Distraction Index for ${label}. ${live ? 'Live updates throughout the week.' : 'Frozen weekly edition.'}`,
  };
}

export default async function WeekPage({ params }: WeekPageProps) {
  const { weekId } = await params;
  const weekStart = resolveWeekParam(weekId);

  if (!weekStart) {
    notFound();
  }

  const wid = toWeekId(weekStart);
  const live = isCurrentWeek(weekStart);

  // Fetch week data and all snapshots in parallel
  const [weekData, allWeeks] = await Promise.all([
    getWeekData(wid),
    getAllWeekSnapshots(),
  ]);

  // Even if there's no data yet, we still show the page shell
  const snapshot = weekData?.snapshot ?? null;

  return (
    <div className="min-h-screen">
      <TopNav />

      {/* Week selector — needs all weeks for navigation */}
      {snapshot && allWeeks.length > 0 && (
        <WeekSelector allWeeks={allWeeks} currentSnapshot={snapshot} />
      )}

      {/* Smokescreen alert */}
      {snapshot && <SmokescreenAlert snapshot={snapshot} />}

      {/* Weekly summary (frozen weeks) */}
      {snapshot && <WeekSummary snapshot={snapshot} />}

      {/* Stats bar */}
      {snapshot && <WeekStatsBar snapshot={snapshot} />}

      {/* Main content */}
      {weekData ? (
        <>
          {/* Narrative strips */}
          <NarrativeStrips
            topDamage={weekData.events.A}
            topDistraction={weekData.events.B}
          />

          {/* Three-column dashboard */}
          <div className="max-w-[1200px] mx-auto px-4 py-2.5">
            <div className="flex gap-2.5 flex-wrap items-start">
              <ListColumn list="A" events={weekData.events.A} />
              <ListColumn list="B" events={weekData.events.B} />
              <ListColumn list="C" events={weekData.events.C} />
            </div>
          </div>
        </>
      ) : (
        /* Empty state */
        <div className="max-w-[600px] mx-auto text-center py-16 px-5">
          <div className="text-4xl mb-3">📭</div>
          <h2 className="text-lg text-text-primary font-serif font-extrabold mb-1.5">
            Week {getWeekNumber(weekStart)}: {getWeekLabel(weekStart)}
          </h2>
          <p className="text-[13px] text-text-dim leading-relaxed">
            {live
              ? 'This week is live but no events have been scored yet. Check back as the week progresses.'
              : 'No data available for this week yet. The pipeline may not have processed this week.'}
          </p>
        </div>
      )}
    </div>
  );
}
