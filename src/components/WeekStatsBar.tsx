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
    {
      label: 'Sources',
      value: snapshot.total_sources,
      delta: prior ? fmtDelta(snapshot.total_sources, prior.total_sources) : undefined,
    },
    {
      label: 'Primary Docs',
      value: snapshot.primary_doc_count,
      delta: prior ? fmtDelta(snapshot.primary_doc_count, prior.primary_doc_count) : undefined,
    },
  ];

  return (
    <div className="bg-white/[0.02] border-b border-white/[0.03] py-1.5 px-4">
      <div className="max-w-[1200px] mx-auto flex gap-3 justify-center flex-wrap">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <div className={`text-base font-extrabold font-mono ${stat.color || 'text-text-primary'}`}>
              {stat.value}
            </div>
            {stat.delta && stat.delta !== '—' && (
              <div className={`text-[10px] font-mono ${stat.delta.startsWith('+') ? 'text-text-muted' : 'text-text-dim'}`}>
                {stat.delta}
              </div>
            )}
            <div className="text-[10.5px] text-text-dim uppercase tracking-wide">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
