import type { Event, PrimaryList } from '@/lib/types';
import { EventCard } from './EventCard';

interface ListColumnProps {
  list: PrimaryList;
  events: Event[];
  /** When set, events older than this many days are visually de-emphasized */
  staleDaysThreshold?: number;
}

const listConfig = {
  A: {
    label: 'Real Damage',
    tag: 'Constitutional Threats',
    colorText: 'text-damage',
    borderColor: 'border-damage',
  },
  B: {
    label: 'Distractions',
    tag: 'Manufactured Outrage',
    colorText: 'text-distraction',
    borderColor: 'border-distraction',
  },
  C: {
    label: 'Noise Floor',
    tag: 'Low Impact',
    colorText: 'text-text-dim',
    borderColor: 'border-text-dim',
  },
};

function isStale(event: Event, thresholdDays: number): boolean {
  if (!event.event_date) return false;
  const eventDate = new Date(event.event_date + 'T00:00:00');
  const now = new Date();
  const diffMs = now.getTime() - eventDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > thresholdDays;
}

export function ListColumn({ list, events, staleDaysThreshold }: ListColumnProps) {
  const config = listConfig[list];

  let recentEvents = events;
  let staleEvents: Event[] = [];

  if (staleDaysThreshold != null) {
    recentEvents = events.filter((e) => !isStale(e, staleDaysThreshold));
    staleEvents = events.filter((e) => isStale(e, staleDaysThreshold));
  }

  return (
    <div className="min-w-0">
      {/* Section header with heavy bottom border */}
      <div className="flex justify-between items-baseline border-b-2 border-border-heavy pb-1 mb-2">
        <span className={`font-sans text-[9px] font-semibold tracking-[2px] uppercase ${config.colorText}`}>
          {config.label}
        </span>
        <span className="font-sans text-[9px] text-text-muted">
          {events.length} {events.length === 1 ? 'event' : 'events'}
        </span>
      </div>

      {events.length === 0 && (
        <div className="text-center text-text-muted text-sm py-5 font-serif">
          No events this week
        </div>
      )}

      {recentEvents.map((event, i) => (
        <EventCard key={event.id} event={event} list={list} rank={i + 1} />
      ))}

      {staleEvents.length > 0 && (
        <>
          <div className="flex items-center gap-2 my-2">
            <span className="flex-1 border-t border-surface-border" />
            <span className="font-sans text-[9px] font-semibold uppercase tracking-[2px] text-text-muted">
              Older
            </span>
            <span className="flex-1 border-t border-surface-border" />
          </div>
          <div className="opacity-50">
            {staleEvents.map((event, i) => (
              <EventCard key={event.id} event={event} list={list} rank={recentEvents.length + i + 1} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
