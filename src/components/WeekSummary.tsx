import type { WeeklySnapshot } from '@/lib/types';

interface WeekSummaryProps {
  snapshot: WeeklySnapshot;
}

export function WeekSummary({ snapshot }: WeekSummaryProps) {
  if (!snapshot.weekly_summary || snapshot.status !== 'frozen') return null;

  return (
    <div className="bg-mixed/[0.03] border-b border-mixed/[0.08] py-2 px-4">
      <div className="max-w-[1200px] mx-auto">
        <div className="text-[10px] font-extrabold text-mixed tracking-widest mb-0.5">
          WHAT ACTUALLY MATTERED
        </div>
        <p className="text-xs text-text-secondary leading-relaxed m-0">
          {snapshot.weekly_summary}
        </p>
      </div>
    </div>
  );
}
