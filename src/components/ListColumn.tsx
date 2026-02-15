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
    colorBg: 'bg-damage/[0.03]',
    colorBorder: 'border-damage/[0.08]',
    colorText: 'text-damage',
  },
  B: {
    label: 'Distractions',
    tag: 'Manufactured Outrage',
    colorBg: 'bg-distraction/[0.03]',
    colorBorder: 'border-distraction/[0.08]',
    colorText: 'text-distraction',
  },
  C: {
    label: 'Noise Floor',
    tag: 'Low Impact',
    colorBg: 'bg-noise/[0.03]',
    colorBorder: 'border-noise/[0.08]',
    colorText: 'text-noise',
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
      <div className={`${config.colorBg} border ${config.colorBorder} rounded-lg p-2.5`}>
        <div className="text-center mb-2.5">
          <div className={`text-sm font-extrabold uppercase tracking-widest ${config.colorText}`}>
            {config.label}
          </div>
          <div className="text-[11.5px] text-text-dim">
            {config.tag} · {events.length} {events.length === 1 ? 'event' : 'events'}
          </div>
        </div>

        {events.length === 0 && (
          <div className="text-center text-surface-border-light text-sm py-5">
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
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-dim">
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
    </div>
  );
}
