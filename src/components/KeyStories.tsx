import Link from 'next/link';
import type { Event, SmokescreenPair } from '@/lib/types';
import { DualScore } from './DualScore';

interface SmokescreenPairData {
  pair: SmokescreenPair & {
    distraction_event: Pick<Event, 'id' | 'title' | 'a_score' | 'b_score'>;
    damage_event: Pick<Event, 'id' | 'title' | 'a_score' | 'b_score'>;
  };
}

interface KeyStoriesProps {
  topDamage: Event | null;
  topDistraction: Event | null;
  topSmokescreenPair: SmokescreenPairData | null;
}

const cardStyles = {
  damage: {
    bg: 'bg-damage/[0.03]',
    border: 'border-damage/[0.08]',
    hoverBorder: 'hover:border-damage/20',
    text: 'text-damage',
    label: 'Top Damage',
  },
  distraction: {
    bg: 'bg-distraction/[0.03]',
    border: 'border-distraction/[0.08]',
    hoverBorder: 'hover:border-distraction/20',
    text: 'text-distraction',
    label: 'Top Distraction',
  },
  smokescreen: {
    bg: 'bg-mixed/[0.03]',
    border: 'border-mixed/[0.08]',
    hoverBorder: 'hover:border-mixed/20',
    text: 'text-mixed',
    label: 'Smokescreen Pair',
  },
};

export function KeyStories({ topDamage, topDistraction, topSmokescreenPair }: KeyStoriesProps) {
  if (!topDamage && !topDistraction) return null;

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-2.5">
      <div className="text-[11.5px] font-bold uppercase tracking-widest text-text-muted mb-2">
        This Week&apos;s Key Stories
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {/* Top Damage */}
        {topDamage && (
          <Link
            href={`/event/${topDamage.id}`}
            className={`${cardStyles.damage.bg} border ${cardStyles.damage.border} ${cardStyles.damage.hoverBorder} rounded-lg p-3 no-underline transition-colors block`}
          >
            <div className={`text-[11px] font-bold uppercase tracking-widest ${cardStyles.damage.text} mb-1`}>
              {cardStyles.damage.label}
            </div>
            <div className="text-[15px] text-text-primary font-bold leading-tight mb-1.5 line-clamp-2">
              {topDamage.title}
            </div>
            {topDamage.summary && (
              <p className="text-[12.5px] text-text-dim leading-relaxed m-0 mb-2 line-clamp-2">
                {topDamage.summary}
              </p>
            )}
            <DualScore aScore={topDamage.a_score} bScore={topDamage.b_score} showLabels />
          </Link>
        )}

        {/* Top Distraction */}
        {topDistraction && (
          <Link
            href={`/event/${topDistraction.id}`}
            className={`${cardStyles.distraction.bg} border ${cardStyles.distraction.border} ${cardStyles.distraction.hoverBorder} rounded-lg p-3 no-underline transition-colors block`}
          >
            <div className={`text-[11px] font-bold uppercase tracking-widest ${cardStyles.distraction.text} mb-1`}>
              {cardStyles.distraction.label}
            </div>
            <div className="text-[15px] text-text-primary font-bold leading-tight mb-1.5 line-clamp-2">
              {topDistraction.title}
            </div>
            {topDistraction.summary && (
              <p className="text-[12.5px] text-text-dim leading-relaxed m-0 mb-2 line-clamp-2">
                {topDistraction.summary}
              </p>
            )}
            <DualScore aScore={topDistraction.a_score} bScore={topDistraction.b_score} showLabels />
          </Link>
        )}

        {/* Smokescreen Pair */}
        {topSmokescreenPair && (
          <Link
            href={`/smokescreen`}
            className={`${cardStyles.smokescreen.bg} border ${cardStyles.smokescreen.border} ${cardStyles.smokescreen.hoverBorder} rounded-lg p-3 no-underline transition-colors block`}
          >
            <div className={`text-[11px] font-bold uppercase tracking-widest ${cardStyles.smokescreen.text} mb-1`}>
              {cardStyles.smokescreen.label}
            </div>
            <div className="text-sm text-distraction font-bold leading-tight mb-0.5">
              {topSmokescreenPair.pair.distraction_event.title}
            </div>
            <div className="text-[11.5px] text-text-dim mb-0.5">is obscuring</div>
            <div className="text-sm text-damage font-bold leading-tight mb-1.5">
              {topSmokescreenPair.pair.damage_event.title}
            </div>
            <div className="text-[12px] font-mono text-mixed">
              SI: {topSmokescreenPair.pair.smokescreen_index.toFixed(1)}
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
