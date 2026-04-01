import type { WeeklySnapshot } from '@/lib/types';

interface SmokescreenAlertProps {
  snapshot: WeeklySnapshot;
}

export function SmokescreenAlert({ snapshot }: SmokescreenAlertProps) {
  const si = snapshot.max_smokescreen_index;
  if (!si || si < 25) return null;

  const severity = si > 50 ? 'CRITICAL' : 'SIGNIFICANT';

  return (
    <div className="max-w-[900px] mx-auto px-5 mt-2">
      <div className="bg-damage-light rounded-[6px] px-3 py-2 flex items-center gap-1.5 flex-wrap">
        <span className="font-sans text-[9px] font-semibold uppercase tracking-[1px] text-damage">
          Smokescreen Alert
        </span>
        <span className="text-xs text-text-primary font-serif">
          {snapshot.top_smokescreen_pair ?? 'Active pairing detected'} · SI: {si.toFixed(1)}{' '}
          <span className="font-bold">{severity}</span>
        </span>
      </div>
    </div>
  );
}
