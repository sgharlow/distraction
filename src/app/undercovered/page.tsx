import type { Metadata } from 'next';
import Link from 'next/link';
import { TopNav } from '@/components/TopNav';
import { DualScore } from '@/components/DualScore';
import { AttentionBudget } from '@/components/AttentionBudget';
import { MechanismBadge } from '@/components/MechanismBadge';
import { ActionItem } from '@/components/ActionItem';
import { getCurrentWeekStart, toWeekId } from '@/lib/weeks';
import { getWeekData } from '@/lib/data/weeks';

export const metadata: Metadata = {
  title: 'Undercovered',
  description: 'High-damage events with low media attention — the stories that matter most.',
};

export default async function UndercoveredPage() {
  const weekStart = getCurrentWeekStart();
  const weekId = toWeekId(weekStart);
  const weekData = await getWeekData(weekId);

  const undercovered = (weekData?.events.A ?? [])
    .filter((e) => {
      const ab = (e.b_score ?? 0) - (e.a_score ?? 0);
      return ab < -30;
    })
    .sort((a, b) => {
      const abA = (a.b_score ?? 0) - (a.a_score ?? 0);
      const abB = (b.b_score ?? 0) - (b.a_score ?? 0);
      return abA - abB; // most undercovered first
    });

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="max-w-[780px] mx-auto px-4 py-6">
        <h1 className="text-lg font-extrabold text-text-primary font-serif mb-1">
          Undercovered High-Damage
        </h1>
        <p className="text-[11.5px] text-text-muted mb-4 leading-relaxed">
          Events with high constitutional damage but low media attention this week
          (Attention Budget &lt; −30).
        </p>

        {undercovered.length === 0 ? (
          <p className="text-text-dim text-xs">No undercovered events this week.</p>
        ) : (
          <div className="space-y-1.5">
            {undercovered.map((event) => (
              <Link
                key={event.id}
                href={`/event/${event.id}`}
                className="block bg-damage/[0.03] border border-damage/[0.08] rounded-lg p-3 no-underline hover:border-damage/20 transition-colors"
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="text-[13px] text-text-primary font-bold">{event.title}</div>
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
      </main>
    </div>
  );
}
