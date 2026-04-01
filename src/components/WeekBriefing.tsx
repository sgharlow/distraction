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
    <div className="max-w-[900px] mx-auto px-5 mb-2">
      <div className="bg-surface-overlay rounded-[6px] px-3 py-2">
        <div className="font-sans text-[9px] font-semibold tracking-[2px] uppercase text-mixed mb-0.5">
          This Week in 30 Seconds
        </div>
        <p className="font-serif text-sm text-text-secondary leading-relaxed m-0">
          {briefing}
        </p>
      </div>
    </div>
  );
}
