import { cn } from '@/lib/utils';

interface DualScoreProps {
  aScore: number | null;
  bScore: number | null;
  size?: 'sm' | 'lg';
}

export function DualScore({ aScore, bScore, size = 'sm' }: DualScoreProps) {
  const a = aScore ?? 0;
  const b = bScore ?? 0;
  const aUp = a >= b;
  const lg = size === 'lg';

  return (
    <div className="flex items-center gap-1">
      {/* A score */}
      <div
        className={cn(
          'rounded text-center border',
          lg ? 'px-3 py-1.5 min-w-[68px]' : 'px-1.5 py-0.5 min-w-[40px]',
          aUp
            ? 'bg-damage/10 border-damage/30'
            : 'bg-damage/[0.03] border-damage/10'
        )}
      >
        <div
          className={cn(
            'font-semibold text-damage opacity-70',
            lg ? 'text-xs' : 'text-[9.5px]'
          )}
        >
          A
        </div>
        <div
          className={cn(
            'font-mono text-damage',
            lg ? 'text-2xl' : 'text-[13px]',
            aUp ? 'font-black opacity-100' : 'font-medium opacity-40'
          )}
        >
          {aScore?.toFixed(1) ?? '—'}
        </div>
      </div>

      {/* B score */}
      <div
        className={cn(
          'rounded text-center border',
          lg ? 'px-3 py-1.5 min-w-[68px]' : 'px-1.5 py-0.5 min-w-[40px]',
          !aUp
            ? 'bg-distraction/10 border-distraction/30'
            : 'bg-distraction/[0.03] border-distraction/10'
        )}
      >
        <div
          className={cn(
            'font-semibold text-distraction opacity-70',
            lg ? 'text-xs' : 'text-[9.5px]'
          )}
        >
          B
        </div>
        <div
          className={cn(
            'font-mono text-distraction',
            lg ? 'text-2xl' : 'text-[13px]',
            !aUp ? 'font-black opacity-100' : 'font-medium opacity-40'
          )}
        >
          {bScore?.toFixed(1) ?? '—'}
        </div>
      </div>
    </div>
  );
}
