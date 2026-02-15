import type { WeeklySnapshot, Event } from '@/lib/types';
import { generateLiveBriefing } from '@/lib/narrative';

interface WeekBriefingProps {
  snapshot: WeeklySnapshot;
  topDamage: Event[];
  topDistraction: Event[];
}

export function WeekBriefing({ snapshot, topDamage, topDistraction }: WeekBriefingProps) {
  if (snapshot.status !== 'live') return null;

  const briefing = generateLiveBriefing({ snapshot, topDamage, topDistraction });
  if (!briefing) return null;

  return (
    <div className="bg-mixed/[0.03] border-b border-mixed/[0.08] py-2 px-4">
      <div className="max-w-[1200px] mx-auto">
        <div className="text-[10px] font-extrabold text-mixed tracking-widest mb-0.5">
          THIS WEEK IN 30 SECONDS
        </div>
        <p className="text-xs text-text-secondary leading-relaxed m-0">
          {briefing}
        </p>
      </div>
    </div>
  );
}
