import type { Metadata } from 'next';
import Link from 'next/link';
import { TopNav } from '@/components/TopNav';
import { DualScore } from '@/components/DualScore';
import { getCurrentWeekStart, toWeekId, getWeekNumber } from '@/lib/weeks';
import { getWeekData } from '@/lib/data/weeks';

export const metadata: Metadata = {
  title: 'Smokescreen Map',
  description: 'Distraction → Damage pairings with displacement evidence.',
};

export default async function SmokescreenPage() {
  const weekStart = getCurrentWeekStart();
  const weekId = toWeekId(weekStart);
  const weekNum = getWeekNumber(weekStart);
  const weekData = await getWeekData(weekId);

  const pairs = (weekData?.smokescreenPairs ?? []).sort(
    (a, b) => b.smokescreen_index - a.smokescreen_index
  );

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="max-w-[860px] mx-auto px-4 py-6">
        <h1 className="text-lg font-extrabold text-text-primary font-serif mb-1">
          Smokescreen Map — Week {weekNum}
        </h1>
        <p className="text-[11.5px] text-text-muted mb-4 leading-relaxed">
          Distraction → Damage pairings with displacement evidence for this week.
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
                        isCritical ? 'text-damage' : 'text-distraction'
                      }`}
                    >
                      {isCritical ? 'CRITICAL' : 'SIGNIFICANT'} SI:{si.toFixed(1)}
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
