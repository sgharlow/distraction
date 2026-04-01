import type { WeeklySnapshot } from '@/lib/types';
import { fmtScore, fmtDelta } from '@/lib/utils';

interface WeekStatsBarProps {
  snapshot: WeeklySnapshot;
  priorSnapshot?: WeeklySnapshot | null;
}

interface Stat {
  label: string;
  value: string | number;
  color?: string;
  delta?: string;
}

export function WeekStatsBar({ snapshot, priorSnapshot }: WeekStatsBarProps) {
  const prior = priorSnapshot ?? null;

  const stats: Stat[] = [
    {
      label: 'Events',
      value: snapshot.total_events,
      delta: prior ? fmtDelta(snapshot.total_events, prior.total_events) : undefined,
    },
    {
      label: 'List A',
      value: snapshot.list_a_count,
      color: 'text-damage',
      delta: prior ? fmtDelta(snapshot.list_a_count, prior.list_a_count) : undefined,
    },
    {
      label: 'List B',
      value: snapshot.list_b_count,
      color: 'text-distraction',
      delta: prior ? fmtDelta(snapshot.list_b_count, prior.list_b_count) : undefined,
    },
    {
      label: 'Noise',
      value: snapshot.list_c_count,
      color: 'text-noise',
      delta: prior ? fmtDelta(snapshot.list_c_count, prior.list_c_count) : undefined,
    },
    {
      label: 'Avg A',
      value: fmtScore(snapshot.avg_a_score),
      color: 'text-damage',
      delta: prior ? fmtDelta(snapshot.avg_a_score, prior.avg_a_score, 1) : undefined,
    },
    {
      label: 'Avg B',
      value: fmtScore(snapshot.avg_b_score),
      color: 'text-distraction',
      delta: prior ? fmtDelta(snapshot.avg_b_score, prior.avg_b_score, 1) : undefined,
    },
  ];

  return (
    <div className="border-l-2 border-border-heavy pl-3">
      <div className="font-sans text-[9px] tracking-[2px] uppercase text-text-dim mb-2">
        By the Numbers
      </div>
      {stats.map((stat) => (
        <div key={stat.label} className="flex items-baseline justify-between mb-1.5">
          <div className="flex items-baseline gap-1">
            <span className={`font-sans text-base font-bold ${stat.color || 'text-text-primary'}`}>
              {stat.value}
            </span>
            <span className="font-sans text-[9px] uppercase tracking-[0.5px] text-text-dim">
              {stat.label}
            </span>
          </div>
          {stat.delta && stat.delta !== '—' && (
            <span className={`font-sans text-[10px] ${
              stat.delta.startsWith('+') ? 'text-action' : 'text-damage'
            }`}>
              {stat.delta}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
