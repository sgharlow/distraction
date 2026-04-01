import { cn, getSeverityLabel } from '@/lib/utils';

interface DualScoreProps {
  aScore: number | null;
  bScore: number | null;
  size?: 'sm' | 'lg';
  showLabels?: boolean;
  showSeverity?: boolean;
}

export function DualScore({ aScore, bScore, size = 'sm', showLabels = false, showSeverity = false }: DualScoreProps) {
  const a = aScore ?? 0;
  const b = bScore ?? 0;
  const lg = size === 'lg';

  // Conditional highlighting: bold + color only when score > 50
  const aHighlight = a > 50;
  const bHighlight = b > 50;

  return (
    <div className="flex items-center gap-1.5">
      {/* A score */}
      <div
        className={cn(
          'text-center border rounded-[3px]',
          lg ? 'px-3 py-1.5 min-w-[68px]' : 'px-1.5 py-0.5 min-w-[40px]',
          aHighlight
            ? 'bg-damage-light border-damage'
            : 'bg-surface-overlay border-surface-border'
        )}
      >
        <div className="font-sans text-[10px] text-text-dim">A</div>
        <div
          className={cn(
            'font-sans',
            lg ? 'text-2xl' : 'text-[15px]',
            aHighlight ? 'font-bold text-damage' : 'text-text-muted'
          )}
        >
          {aScore?.toFixed(1) ?? '—'}
        </div>
        {showLabels && (
          <div className="font-sans text-[9px] text-text-muted leading-tight">
            Constitutional Damage
          </div>
        )}
        {showSeverity && aScore != null && (
          <div className={cn('font-sans text-[10px] font-bold leading-tight mt-0.5', aHighlight ? 'text-damage' : 'text-text-muted')}>
            {getSeverityLabel(aScore)}
          </div>
        )}
      </div>

      {/* B score */}
      <div
        className={cn(
          'text-center border rounded-[3px]',
          lg ? 'px-3 py-1.5 min-w-[68px]' : 'px-1.5 py-0.5 min-w-[40px]',
          bHighlight
            ? 'bg-distraction-light border-distraction'
            : 'bg-surface-overlay border-surface-border'
        )}
      >
        <div className="font-sans text-[10px] text-text-dim">B</div>
        <div
          className={cn(
            'font-sans',
            lg ? 'text-2xl' : 'text-[15px]',
            bHighlight ? 'font-bold text-distraction' : 'text-text-muted'
          )}
        >
          {bScore?.toFixed(1) ?? '—'}
        </div>
        {showLabels && (
          <div className="font-sans text-[9px] text-text-muted leading-tight">
            Media Hype
          </div>
        )}
        {showSeverity && bScore != null && (
          <div className={cn('font-sans text-[10px] font-bold leading-tight mt-0.5', bHighlight ? 'text-distraction' : 'text-text-muted')}>
            {getSeverityLabel(bScore)}
          </div>
        )}
      </div>
    </div>
  );
}
