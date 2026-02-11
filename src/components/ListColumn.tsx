import type { Event, PrimaryList } from '@/lib/types';
import { EventCard } from './EventCard';

interface ListColumnProps {
  list: PrimaryList;
  events: Event[];
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

export function ListColumn({ list, events }: ListColumnProps) {
  const config = listConfig[list];

  return (
    <div className="flex-1 min-w-[280px]">
      <div className={`${config.colorBg} border ${config.colorBorder} rounded-lg p-2.5`}>
        <div className="text-center mb-2.5">
          <div className={`text-xs font-extrabold uppercase tracking-widest ${config.colorText}`}>
            {config.label}
          </div>
          <div className="text-[9.5px] text-text-dim">
            {config.tag} · {events.length} {events.length === 1 ? 'event' : 'events'}
          </div>
        </div>

        {events.length === 0 && (
          <div className="text-center text-surface-border-light text-xs py-5">
            No events this week
          </div>
        )}

        {events.map((event, i) => (
          <EventCard key={event.id} event={event} list={list} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}
