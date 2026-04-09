import Link from 'next/link';
import type { Event, PrimaryList } from '@/lib/types';
import { AttentionBudget } from './AttentionBudget';

interface EventCardProps {
  event: Event;
  list: PrimaryList;
  rank: number;
}

export function EventCard({ event, list, rank }: EventCardProps) {
  const isNoise = list === 'C';
  const isDamage = list === 'A';

  // Conditional score highlighting: bold + color only when score > 50
  const aScore = event.a_score ?? 0;
  const bScore = event.b_score ?? 0;
  const aHighlight = aScore > 50;
  const bHighlight = bScore > 50;

  // Attention budget tag
  const ab = bScore - aScore;
  let tagLabel: string | null = null;
  let tagClasses = '';
  if (ab > 30) {
    tagLabel = 'HYPE';
    tagClasses = 'bg-distraction-light text-distraction';
  } else if (ab < -30) {
    tagLabel = 'UNDERCOVERED';
    tagClasses = 'bg-damage-light text-damage';
  }

  return (
    <Link
      href={`/event/${event.id}`}
      className="flex items-baseline gap-1.5 py-1 border-b border-surface-border-light no-underline hover:bg-surface-overlay transition-colors"
    >
      {/* Row number */}
      <span className={`font-sans text-[10px] min-w-[14px] ${isNoise ? 'text-text-quiet' : 'text-text-muted'}`}>
        {rank}
      </span>

      {/* Event content */}
      <div className="flex-1 min-w-0">
        <div className={`font-serif text-xs leading-[1.3] ${
          isNoise ? 'text-text-dim' : isDamage ? 'font-semibold text-text-primary' : 'text-text-primary'
        }`}>
          {event.title}
        </div>
        <div className="font-sans text-[9px] text-text-muted">
          {event.event_date}
          {event.article_count > 0 && ` · ${event.article_count} src`}
        </div>
      </div>

      {/* Tag badge (if not noise) */}
      {tagLabel && !isNoise && (
        <span className={`font-sans text-[9px] px-1 py-px rounded-[2px] whitespace-nowrap ${tagClasses}`}>
          {tagLabel}
        </span>
      )}

      {/* Scores (not shown for noise) */}
      {!isNoise && (
        <div className="flex gap-1 shrink-0">
          <span className={`font-sans text-[10px] whitespace-nowrap ${
            aHighlight ? 'font-bold text-damage' : 'text-text-muted'
          }`}>
            {event.a_score?.toFixed(1) ?? '—'}
          </span>
          <span className={`font-sans text-[10px] whitespace-nowrap ${
            bHighlight ? 'font-bold text-distraction' : 'text-text-muted'
          }`}>
            {event.b_score?.toFixed(1) ?? '—'}
          </span>
        </div>
      )}
    </Link>
  );
}
