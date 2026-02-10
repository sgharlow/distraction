import type { WeeklySnapshot } from '@/lib/types';
import { fmtScore } from '@/lib/utils';

interface WeekStatsBarProps {
  snapshot: WeeklySnapshot;
}

interface Stat {
  label: string;
  value: string | number;
  color?: string;
}

export function WeekStatsBar({ snapshot }: WeekStatsBarProps) {
  const stats: Stat[] = [
    { label: 'Events', value: snapshot.total_events },
    { label: 'List A', value: snapshot.list_a_count, color: 'text-damage' },
    { label: 'List B', value: snapshot.list_b_count, color: 'text-distraction' },
    { label: 'Noise', value: snapshot.list_c_count, color: 'text-noise' },
    { label: 'Avg A', value: fmtScore(snapshot.avg_a_score), color: 'text-damage' },
    { label: 'Avg B', value: fmtScore(snapshot.avg_b_score), color: 'text-distraction' },
    { label: 'Sources', value: snapshot.total_sources },
    { label: 'Primary Docs', value: snapshot.primary_doc_count },
  ];

  return (
    <div className="bg-white/[0.02] border-b border-white/[0.03] py-1.5 px-4">
      <div className="max-w-[1200px] mx-auto flex gap-3 justify-center flex-wrap">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <div className={`text-sm font-extrabold font-mono ${stat.color || 'text-text-primary'}`}>
              {stat.value}
            </div>
            <div className="text-[8.5px] text-text-dim uppercase tracking-wide">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
