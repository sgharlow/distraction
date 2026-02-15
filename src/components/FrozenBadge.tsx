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
        'text-[10.5px] bg-gray-700 text-text-muted px-1 py-px rounded',
        className
      )}
    >
      🔒{version != null ? ` v${version}` : ''}
    </span>
  );
}
