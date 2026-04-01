import type { WeekStatus } from '@/lib/types';

interface StatusBadgeProps {
  status: WeekStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const isLive = status === 'live';

  return (
    <span
      className={`font-sans text-[9px] font-semibold px-1.5 py-px rounded-[3px] ${
        isLive
          ? 'text-white bg-action'
          : 'text-text-dim bg-surface-overlay'
      }`}
    >
      {isLive ? 'LIVE' : 'FROZEN'}
    </span>
  );
}
