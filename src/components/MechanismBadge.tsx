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
      <span className="text-[11.5px] bg-gray-700 text-text-secondary px-1.5 py-px rounded">
        {MECHANISM_LABELS[mechanism]}
      </span>
      {scope && (
        <span className="text-[11.5px] bg-gray-800 text-text-muted px-1.5 py-px rounded">
          {scope.replace('_', ' ')}{affectedPopulation ? ` · ${affectedPopulation}` : ''}
        </span>
      )}
    </div>
  );
}
