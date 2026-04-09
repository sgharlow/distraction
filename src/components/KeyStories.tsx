import Link from 'next/link';
import type { Event, SmokescreenPair } from '@/lib/types';

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

function ScoreDisplay({ label, score, threshold, colorClass }: {
  label: string;
  score: number | null;
  threshold: number;
  colorClass: string;
}) {
  const val = score ?? 0;
  const highlight = val > threshold;
  return (
    <span className={`font-sans text-[10px] ${highlight ? `font-bold ${colorClass}` : 'text-text-muted'}`}>
      {label}: {score?.toFixed(1) ?? '—'}
    </span>
  );
}

export function KeyStories({ topDamage, topDistraction, topSmokescreenPair }: KeyStoriesProps) {
  if (!topDamage && !topDistraction) return null;

  return (
    <div className="max-w-[900px] mx-auto px-5 mb-4">
      {/* Double-rule divider */}
      <div className="border-t-[3px] border-double border-border-heavy pt-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Top Damage */}
          {topDamage && (
            <Link href={`/event/${topDamage.id}`} className="no-underline block">
              <div className="font-sans text-[8px] font-semibold tracking-[2.5px] uppercase text-damage mb-1.5">
                Top Damage · Dmg: {topDamage.a_score?.toFixed(1)}
              </div>
              <div className="font-serif text-base font-bold leading-[1.25] text-text-primary mb-1">
                {topDamage.title}
              </div>
              {topDamage.summary && (
                <p className="text-[11px] font-serif text-text-secondary leading-[1.4] m-0 mb-1.5 line-clamp-2">
                  {topDamage.summary}
                </p>
              )}
              <div className="flex gap-1.5 items-center">
                <ScoreDisplay label="Dmg" score={topDamage.a_score} threshold={50} colorClass="text-damage" />
                <ScoreDisplay label="Hype" score={topDamage.b_score} threshold={50} colorClass="text-distraction" />
                <span className="font-sans text-[9px] text-text-muted">
                  {topDamage.article_count} {topDamage.article_count === 1 ? 'src' : 'srcs'}
                </span>
              </div>
            </Link>
          )}

          {/* Top Distraction */}
          {topDistraction && (
            <Link href={`/event/${topDistraction.id}`} className="no-underline block">
              <div className="font-sans text-[8px] font-semibold tracking-[2.5px] uppercase text-distraction mb-1.5">
                Top Hype · Hype: {topDistraction.b_score?.toFixed(1)}
              </div>
              <div className="font-serif text-base font-bold leading-[1.25] text-text-primary mb-1">
                {topDistraction.title}
              </div>
              {topDistraction.summary && (
                <p className="text-[11px] font-serif text-text-secondary leading-[1.4] m-0 mb-1.5 line-clamp-2">
                  {topDistraction.summary}
                </p>
              )}
              <div className="flex gap-1.5 items-center">
                <ScoreDisplay label="Dmg" score={topDistraction.a_score} threshold={50} colorClass="text-damage" />
                <ScoreDisplay label="Hype" score={topDistraction.b_score} threshold={50} colorClass="text-distraction" />
                <span className="font-sans text-[9px] text-text-muted">
                  {topDistraction.article_count} {topDistraction.article_count === 1 ? 'src' : 'srcs'}
                </span>
              </div>
            </Link>
          )}
        </div>

        {/* Smokescreen pair callout */}
        {topSmokescreenPair && (
          <div className="bg-surface-overlay rounded-[6px] px-3 py-2.5 mt-3 flex items-center gap-1.5 flex-wrap text-xs font-serif">
            <span className="font-sans text-[9px] font-semibold uppercase tracking-[1px] text-mixed">
              Smokescreen
            </span>
            <span className="font-bold">{topSmokescreenPair.pair.distraction_event.title}</span>
            <span className="text-damage italic text-[11px]">is obscuring</span>
            <span className="font-bold">{topSmokescreenPair.pair.damage_event.title}</span>
            <span className="font-sans text-[10px] font-semibold bg-text-primary text-surface-base px-2 py-px rounded-[3px]">
              SI: {topSmokescreenPair.pair.smokescreen_index.toFixed(1)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
