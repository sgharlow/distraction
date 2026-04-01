import type { MechanismOfHarm, Scope, AffectedPopulation } from '@/lib/types';
import { MECHANISM_LABELS } from '@/lib/types';

interface MechanismBadgeProps {
  mechanism: MechanismOfHarm | null;
  scope?: Scope | null;
  affectedPopulation?: AffectedPopulation | null;
}

export function MechanismBadge({ mechanism, scope, affectedPopulation }: MechanismBadgeProps) {
  if (!mechanism) return null;

  return (
    <div className="flex gap-1 flex-wrap mt-0.5">
      <span className="font-sans text-[9px] bg-surface-overlay text-text-secondary px-1.5 py-px rounded-[2px]">
        {MECHANISM_LABELS[mechanism]}
      </span>
      {scope && (
        <span className="font-sans text-[9px] bg-surface-overlay text-text-muted px-1.5 py-px rounded-[2px]">
          {scope.replace('_', ' ')}{affectedPopulation ? ` · ${affectedPopulation}` : ''}
        </span>
      )}
    </div>
  );
}
