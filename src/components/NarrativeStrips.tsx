import type { Event } from '@/lib/types';

interface NarrativeStripsProps {
  topDamage: Event[];
  topDistraction: Event[];
}

export function NarrativeStrips({ topDamage, topDistraction }: NarrativeStripsProps) {
  const damageItems = topDamage.slice(0, 2);
  const distractionItems = topDistraction.slice(0, 2);

  if (!damageItems.length && !distractionItems.length) return null;

  return (
    <div className="max-w-[900px] mx-auto px-5 mb-3.5">
      <div className="bg-surface-overlay rounded-[6px] px-3 py-2.5 grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Look at this (real damage) */}
        {damageItems.length > 0 && (
          <div>
            <div className="font-sans text-[8px] font-semibold tracking-[2px] uppercase text-action mb-1">
              Look at this
            </div>
            {damageItems.map((e, i) => (
              <div
                key={e.id}
                className={`text-[11px] font-serif leading-[1.4] ${
                  i > 0 ? 'text-text-dim mt-0.5' : 'text-text-primary'
                }`}
              >
                {e.title}
              </div>
            ))}
          </div>
        )}

        {/* They want you to look at (distractions) */}
        {distractionItems.length > 0 && (
          <div>
            <div className="font-sans text-[8px] font-semibold tracking-[2px] uppercase text-damage mb-1">
              They want you to look at
            </div>
            {distractionItems.map((e, i) => (
              <div
                key={e.id}
                className={`text-[11px] font-serif leading-[1.4] ${
                  i > 0 ? 'text-text-dim mt-0.5' : 'text-text-primary'
                }`}
              >
                {e.title}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
