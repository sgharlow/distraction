import type { WeekStatus } from '@/lib/types';

interface StatusBadgeProps {
  status: WeekStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const isLive = status === 'live';

  return (
    <span
      className={`text-[10px] font-bold px-2 py-px rounded-full border ${
        isLive
          ? 'text-live bg-live/[0.08] border-live/20'
          : 'text-text-dim bg-white/[0.03] border-white/[0.06]'
      }`}
    >
      {isLive ? '🟢 LIVE' : '🔒 FROZEN'}
    </span>
  );
}
