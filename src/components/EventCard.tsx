import Link from 'next/link';
import type { Event, PrimaryList } from '@/lib/types';
import { DualScore } from './DualScore';
import { AttentionBudget } from './AttentionBudget';
import { MixedBadge } from './MixedBadge';

interface EventCardProps {
  event: Event;
  list: PrimaryList;
  rank: number;
}

const listColors = {
  A: {
    text: 'text-damage',
    hoverBg: 'hover:bg-damage/5',
    hoverBorder: 'hover:border-damage/25',
  },
  B: {
    text: 'text-distraction',
    hoverBg: 'hover:bg-distraction/5',
    hoverBorder: 'hover:border-distraction/25',
  },
  C: {
    text: 'text-noise',
    hoverBg: 'hover:bg-noise/5',
    hoverBorder: 'hover:border-noise/25',
  },
};

export function EventCard({ event, list, rank }: EventCardProps) {
  const isNoise = list === 'C';
  const colors = listColors[list];

  return (
    <Link
      href={`/event/${event.id}`}
      className={`block bg-surface-raised border border-surface-border rounded-md px-2.5 py-2 mb-1 transition-all duration-100 ${colors.hoverBg} ${colors.hoverBorder}`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`text-[13.5px] font-extrabold min-w-[18px] font-mono ${colors.text}`}>
          #{rank}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex gap-1 items-center">
            <span className="text-sm text-text-primary font-semibold leading-tight truncate">
              {event.title}
            </span>
            {event.is_mixed && <MixedBadge />}
          </div>
          <div className="flex gap-1.5 items-center mt-px flex-wrap">
            <span className="text-[11.5px] text-text-dim">{event.event_date}</span>
            {!isNoise && <AttentionBudget aScore={event.a_score} bScore={event.b_score} />}
          </div>
        </div>
        {isNoise ? (
          <div className="text-sm font-extrabold text-noise font-mono">
            {event.noise_score?.toFixed(0) ?? '—'}
          </div>
        ) : (
          <DualScore aScore={event.a_score} bScore={event.b_score} />
        )}
      </div>
    </Link>
  );
}
