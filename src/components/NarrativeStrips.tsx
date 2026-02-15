import type { Event } from '@/lib/types';

interface NarrativeStripsProps {
  topDamage: Event[];
  topDistraction: Event[];
}

export function NarrativeStrips({ topDamage, topDistraction }: NarrativeStripsProps) {
  const damageText = topDamage.slice(0, 2).map((e) => e.title).join(' · ');
  const distractionText = topDistraction.slice(0, 2).map((e) => e.title).join(' · ');

  if (!damageText && !distractionText) return null;

  return (
    <div className="max-w-[1200px] mx-auto px-4 pt-2 flex gap-2 flex-wrap">
      {damageText && (
        <div className="flex-1 min-w-[250px] bg-damage/[0.03] border border-damage/[0.08] rounded-md px-2.5 py-1.5">
          <div className="text-[11.5px] font-extrabold text-damage tracking-widest mb-px">
            LOOK AT THIS
          </div>
          <div className="text-[13.5px] text-damage-light">{damageText}</div>
        </div>
      )}
      {distractionText && (
        <div className="flex-1 min-w-[250px] bg-distraction/[0.03] border border-distraction/[0.08] rounded-md px-2.5 py-1.5">
          <div className="text-[11.5px] font-extrabold text-distraction tracking-widest mb-px">
            THEY WANT YOU TO LOOK AT
          </div>
          <div className="text-[13.5px] text-distraction-light">{distractionText}</div>
        </div>
      )}
    </div>
  );
}
