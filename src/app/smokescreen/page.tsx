import Link from 'next/link';
import { TopNav } from '@/components/TopNav';
import { DualScore } from '@/components/DualScore';
import { resolveWeekParam, toWeekId, getWeekLabel, getWeekNumber, isCurrentWeek } from '@/lib/weeks';
import { getWeekData, getAllWeekSnapshots } from '@/lib/data/weeks';

interface SmokescreenPageProps {
  searchParams: Promise<{ week?: string }>;
}

export async function generateMetadata({ searchParams }: SmokescreenPageProps) {
  const sp = await searchParams;
  const weekStart = resolveWeekParam(sp.week ?? 'current');
  if (!weekStart) return { title: 'Smokescreen Map' };
  return {
    title: `Smokescreen Map — Week ${getWeekNumber(weekStart)}`,
    description: 'Distraction → Damage pairings with displacement evidence.',
  };
}

export default async function SmokescreenPage({ searchParams }: SmokescreenPageProps) {
  const sp = await searchParams;
  const weekStart = resolveWeekParam(sp.week ?? 'current');
  if (!weekStart) {
    return (
      <div className="min-h-screen">
        <TopNav />
        <main className="max-w-[860px] mx-auto px-4 py-6">
          <p className="text-text-dim text-xs">Invalid week.</p>
        </main>
      </div>
    );
  }

  const weekId = toWeekId(weekStart);
  const weekNum = getWeekNumber(weekStart);
  const live = isCurrentWeek(weekStart);
  const weekData = await getWeekData(weekId);
  const allWeeks = await getAllWeekSnapshots();

  const prevWeek = allWeeks.find((w) => w.week_id < weekId);
  const nextWeek = live ? null : allWeeks.find((w) => w.week_id > weekId);

  const pairs = (weekData?.smokescreenPairs ?? []).sort(
    (a, b) => b.smokescreen_index - a.smokescreen_index
  );

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="max-w-[860px] mx-auto px-4 py-6">
        {/* Week nav */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-extrabold text-text-primary font-serif mb-0.5">
              Smokescreen Map — Week {weekNum}
            </h1>
            <p className="text-[11px] text-text-muted m-0">
              {getWeekLabel(weekStart)}
              {live ? ' · 🟢 LIVE' : ' · 🔒 FROZEN'}
            </p>
          </div>
          <div className="flex gap-1">
            {prevWeek ? (
              <Link
                href={`/smokescreen?week=${prevWeek.week_id}`}
                className="px-2 py-1 rounded border border-surface-border text-[10.5px] font-semibold text-text-dim hover:text-mixed hover:border-mixed/25 transition-colors no-underline"
              >
                ◀ Prev
              </Link>
            ) : (
              <span className="px-2 py-1 rounded border border-surface-border text-[10.5px] font-semibold text-text-dim/30">◀ Prev</span>
            )}
            {nextWeek ? (
              <Link
                href={`/smokescreen?week=${nextWeek.week_id}`}
                className="px-2 py-1 rounded border border-surface-border text-[10.5px] font-semibold text-text-dim hover:text-mixed hover:border-mixed/25 transition-colors no-underline"
              >
                Next ▶
              </Link>
            ) : (
              <span className="px-2 py-1 rounded border border-surface-border text-[10.5px] font-semibold text-text-dim/30">Next ▶</span>
            )}
          </div>
        </div>

        <p className="text-[11.5px] text-text-muted mb-4 leading-relaxed">
          Distraction → Damage pairings with displacement evidence.
        </p>

        {pairs.length === 0 ? (
          <p className="text-text-dim text-xs">No smokescreen pairings this week.</p>
        ) : (
          <div className="space-y-1.5">
            {pairs.map((pair) => {
              const si = pair.smokescreen_index;
              const isCritical = si > 50;
              const dc = pair.displacement_confidence ?? 0;
              const dispLabel = dc >= 0.7 ? 'HIGH' : dc >= 0.4 ? 'MED' : 'LOW';
              const dispColor = dc >= 0.7 ? 'text-live' : dc >= 0.4 ? 'text-distraction' : 'text-text-dim';

              return (
                <div
                  key={pair.id}
                  className={`bg-surface-raised border rounded-lg p-3 ${
                    isCritical ? 'border-damage/15' : 'border-distraction/15'
                  }`}
                >
                  {/* SI header */}
                  <div className="text-center mb-2">
                    <span
                      className={`text-[10.5px] font-extrabold tracking-widest ${
                        isCritical ? 'text-damage' : si >= 25 ? 'text-distraction' : 'text-text-muted'
                      }`}
                    >
                      {isCritical ? 'CRITICAL' : si >= 25 ? 'SIGNIFICANT' : 'LOW'} SI:{si.toFixed(1)}
                    </span>
                    <span className={`text-[9.5px] ml-2 font-bold ${dispColor}`}>
                      Disp:{dispLabel}
                    </span>
                  </div>

                  {/* Pair display */}
                  <div className="flex gap-2 items-center">
                    {/* Distraction side */}
                    <Link
                      href={`/event/${pair.distraction_event.id}`}
                      className="flex-1 bg-distraction/[0.03] border border-distraction/[0.06] rounded-md p-2 no-underline hover:border-distraction/15 transition-colors"
                    >
                      <div className="text-[8.5px] font-bold tracking-widest text-distraction mb-0.5">
                        DISTRACTION
                      </div>
                      <div className="text-[11.5px] text-text-primary font-semibold leading-tight">
                        {pair.distraction_event.title}
                      </div>
                      <div className="mt-1">
                        <DualScore
                          aScore={pair.distraction_event.a_score}
                          bScore={pair.distraction_event.b_score}
                        />
                      </div>
                    </Link>

                    <div className="text-damage text-sm font-bold">→</div>

                    {/* Damage side */}
                    <Link
                      href={`/event/${pair.damage_event.id}`}
                      className="flex-1 bg-damage/[0.03] border border-damage/[0.06] rounded-md p-2 no-underline hover:border-damage/15 transition-colors"
                    >
                      <div className="text-[8.5px] font-bold tracking-widest text-damage mb-0.5">
                        REAL DAMAGE
                      </div>
                      <div className="text-[11.5px] text-text-primary font-semibold leading-tight">
                        {pair.damage_event.title}
                      </div>
                      <div className="mt-1">
                        <DualScore
                          aScore={pair.damage_event.a_score}
                          bScore={pair.damage_event.b_score}
                        />
                      </div>
                    </Link>
                  </div>

                  {/* Evidence notes */}
                  {pair.evidence_notes && (
                    <div className="mt-2 text-[10px] text-text-dim italic">
                      {pair.evidence_notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
