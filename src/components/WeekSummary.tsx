import type { WeeklySnapshot } from '@/lib/types';

interface WeekSummaryProps {
  snapshot: WeeklySnapshot;
}

export function WeekSummary({ snapshot }: WeekSummaryProps) {
  if (!snapshot.weekly_summary || snapshot.status !== 'frozen') return null;

  return (
    <div className="max-w-[900px] mx-auto px-5 mt-2">
      <div className="bg-surface-overlay rounded-[6px] px-3 py-2">
        <div className="font-sans text-[9px] font-semibold tracking-[2px] uppercase text-mixed mb-0.5">
          What Actually Mattered
        </div>
        <p className="font-serif text-xs text-text-secondary leading-relaxed m-0">
          {snapshot.weekly_summary}
        </p>
      </div>
    </div>
  );
}
