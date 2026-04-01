import type { Event, SmokescreenPair, WeeklySnapshot } from '@/lib/types';
import { WeekStatsBar } from './WeekStatsBar';

interface SmokescreenPairData {
  pair: SmokescreenPair & {
    distraction_event: Pick<Event, 'id' | 'title' | 'a_score' | 'b_score'>;
    damage_event: Pick<Event, 'id' | 'title' | 'a_score' | 'b_score'>;
  };
}

interface HeroPullQuoteProps {
  snapshot: WeeklySnapshot;
  priorSnapshot?: WeeklySnapshot | null;
  topDamage: Event | null;
  topDistraction: Event | null;
  topSmokescreenPair: SmokescreenPairData | null;
}

export function HeroPullQuote({
  snapshot,
  priorSnapshot,
  topDamage,
  topDistraction,
  topSmokescreenPair,
}: HeroPullQuoteProps) {
  // Auto-generate pull-quote from smokescreen pair, or fallback to top events
  let quoteText: React.ReactNode;
  let bodyText: string | null = null;

  if (topSmokescreenPair) {
    const distName = topSmokescreenPair.pair.distraction_event.title;
    const dmgName = topSmokescreenPair.pair.damage_event.title;
    quoteText = (
      <>
        While they talked about {distName},{' '}
        <em>{dmgName.toLowerCase()}</em>.
      </>
    );
    bodyText = topSmokescreenPair.pair.evidence_notes ?? null;
  } else if (topDamage && topDistraction) {
    quoteText = (
      <>
        While they talked about {topDistraction.title},{' '}
        <em>{topDamage.title.toLowerCase()}</em>.
      </>
    );
    bodyText = topDamage.summary ?? null;
  } else if (topDamage) {
    quoteText = <>{topDamage.title}</>;
    bodyText = topDamage.summary ?? null;
  } else {
    quoteText = <>No events scored yet this week.</>;
  }

  return (
    <div className="max-w-[900px] mx-auto px-5 py-4">
      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4">
        {/* Left column — Pull Quote */}
        <div>
          <div className="font-serif text-[26px] font-bold leading-[1.15] tracking-[-0.5px] mb-2.5 text-text-primary">
            {quoteText}
          </div>
          {bodyText && (
            <p className="text-xs text-text-secondary leading-relaxed m-0">
              {bodyText}
            </p>
          )}
        </div>

        {/* Right column — Sidebar Stats */}
        <WeekStatsBar snapshot={snapshot} priorSnapshot={priorSnapshot} />
      </div>
    </div>
  );
}
