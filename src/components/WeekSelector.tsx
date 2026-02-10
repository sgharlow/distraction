'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { StatusBadge } from './StatusBadge';
import type { WeeklySnapshot } from '@/lib/types';

interface WeekSelectorProps {
  /** All week snapshots, newest first */
  allWeeks: WeeklySnapshot[];
  /** Currently displayed week */
  currentSnapshot: WeeklySnapshot;
}

function formatShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFull(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getWeekNum(weekStart: string): number {
  const first = new Date('2024-12-29T00:00:00');
  const start = new Date(weekStart + 'T00:00:00');
  const diffMs = start.getTime() - first.getTime();
  return Math.round(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
}

export function WeekSelector({ allWeeks, currentSnapshot }: WeekSelectorProps) {
  const router = useRouter();
  const [showPicker, setShowPicker] = useState(false);

  const currentIdx = allWeeks.findIndex((w) => w.week_id === currentSnapshot.week_id);
  const canPrev = currentIdx < allWeeks.length - 1;
  const canNext = currentIdx > 0;

  const navigateTo = useCallback(
    (weekId: string) => {
      const isLive = allWeeks[0]?.week_id === weekId;
      router.push(`/week/${isLive ? 'current' : weekId}`);
    },
    [router, allWeeks]
  );

  const goPrev = useCallback(() => {
    if (canPrev) navigateTo(allWeeks[currentIdx + 1].week_id);
  }, [canPrev, currentIdx, allWeeks, navigateTo]);

  const goNext = useCallback(() => {
    if (canNext) navigateTo(allWeeks[currentIdx - 1].week_id);
  }, [canNext, currentIdx, allWeeks, navigateTo]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goPrev, goNext]);

  const weekNum = getWeekNum(currentSnapshot.week_start);

  return (
    <div className="bg-surface-overlay border-b border-surface-border py-2 px-4">
      <div className="max-w-[1200px] mx-auto">
        {/* Navigation row */}
        <div className="flex items-center justify-center gap-2.5 flex-wrap">
          <button
            onClick={goPrev}
            disabled={!canPrev}
            className="bg-transparent border border-surface-border-light rounded px-2.5 py-1 text-sm font-bold text-text-primary disabled:text-surface-border-light disabled:cursor-default cursor-pointer"
            aria-label="Previous week"
          >
            ◀
          </button>

          <div className="text-center min-w-[260px]">
            <div className="text-base font-extrabold text-text-primary font-serif">
              {formatShort(currentSnapshot.week_start)} – {formatFull(currentSnapshot.week_end)}
            </div>
            <div className="flex gap-1.5 justify-center items-center mt-0.5">
              <span className="text-[10px] text-text-dim">Week {weekNum}</span>
              <StatusBadge status={currentSnapshot.status} />
            </div>
          </div>

          <button
            onClick={goNext}
            disabled={!canNext}
            className="bg-transparent border border-surface-border-light rounded px-2.5 py-1 text-sm font-bold text-text-primary disabled:text-surface-border-light disabled:cursor-default cursor-pointer"
            aria-label="Next week"
          >
            ▶
          </button>

          <button
            onClick={() => setShowPicker(!showPicker)}
            className="bg-transparent border border-surface-border-light rounded px-2 py-1 text-[13px] text-text-muted cursor-pointer"
            aria-label="Open week picker"
          >
            📅
          </button>
        </div>

        {/* Quick-jump buttons */}
        <div className="flex gap-1 justify-center mt-1.5 flex-wrap">
          {allWeeks.length > 0 && (
            <QuickButton
              label="This Week"
              active={currentIdx === 0}
              onClick={() => navigateTo(allWeeks[0].week_id)}
            />
          )}
          {allWeeks.length > 1 && (
            <QuickButton
              label="Last Week"
              active={currentIdx === 1}
              onClick={() => navigateTo(allWeeks[1].week_id)}
            />
          )}
          {allWeeks.length > 4 && (
            <QuickButton
              label="Inauguration"
              active={false}
              onClick={() => {
                // Week of Jan 19, 2025 (inauguration day Jan 20)
                const inaugWeek = allWeeks.find((w) => w.week_start === '2025-01-19');
                if (inaugWeek) navigateTo(inaugWeek.week_id);
              }}
            />
          )}
        </div>

        {/* Dropdown picker */}
        {showPicker && (
          <div className="mt-2 bg-[#0f0f28] border border-surface-border-light rounded-md p-2 max-h-[200px] overflow-y-auto">
            <div className="text-[10px] text-text-dim font-bold tracking-widest mb-1">
              ALL WEEKS
            </div>
            {allWeeks.map((w) => {
              const selected = w.week_id === currentSnapshot.week_id;
              const isLive = w.status === 'live';
              return (
                <div
                  key={w.week_id}
                  onClick={() => {
                    navigateTo(w.week_id);
                    setShowPicker(false);
                  }}
                  className={`px-2 py-1 rounded cursor-pointer text-[11px] mb-px flex justify-between ${
                    selected
                      ? 'bg-mixed/[0.08] text-mixed font-bold'
                      : 'text-text-secondary hover:bg-white/[0.03]'
                  }`}
                >
                  <span>
                    Wk {getWeekNum(w.week_start)}: {formatShort(w.week_start)} –{' '}
                    {formatFull(w.week_end)}
                  </span>
                  {isLive && (
                    <span className="text-live text-[9px] font-bold">LIVE</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function QuickButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 rounded border text-[10px] font-semibold cursor-pointer ${
        active
          ? 'bg-mixed/[0.08] border-mixed/25 text-mixed'
          : 'bg-transparent border-surface-border-light text-text-dim hover:text-text-muted'
      }`}
    >
      {label}
    </button>
  );
}
