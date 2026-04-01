import { cn } from '@/lib/utils';

interface FrozenBadgeProps {
  frozen: boolean;
  version?: number;
  className?: string;
}

export function FrozenBadge({ frozen, version, className }: FrozenBadgeProps) {
  if (!frozen) return null;

  return (
    <span
      className={cn(
        'font-sans text-[9px] bg-surface-overlay text-text-muted px-1 py-px rounded-[2px]',
        className
      )}
    >
      🔒{version != null ? ` v${version}` : ''}
    </span>
  );
}
