import type { WeeklySnapshot } from '@/lib/types';

interface SmokescreenAlertProps {
  snapshot: WeeklySnapshot;
}

export function SmokescreenAlert({ snapshot }: SmokescreenAlertProps) {
  const si = snapshot.max_smokescreen_index;
  if (!si || si < 25) return null;

  const severity = si > 50 ? 'CRITICAL' : 'SIGNIFICANT';

  return (
    <div className="bg-damage/5 border-b border-damage/10 py-1.5 px-4">
      <div className="max-w-[1200px] mx-auto flex items-center gap-1.5">
        <span className="text-[11px]">⚠️</span>
        <span className="text-[10.5px] text-damage-light">
          <strong>Smokescreen:</strong>{' '}
          {snapshot.top_smokescreen_pair ?? 'Active pairing detected'} · SI: {si.toFixed(1)}{' '}
          <span className="font-bold">{severity}</span>
        </span>
      </div>
    </div>
  );
}
