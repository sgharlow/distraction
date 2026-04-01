'use client';

import { useRouter } from 'next/navigation';
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
    <div className="border-b border-surface-border py-2 px-5">
      <div className="max-w-[900px] mx-auto">
        {/* Navigation row */}
        <div className="flex items-center justify-center gap-2.5 flex-wrap font-sans">
          <button
            onClick={goPrev}
            disabled={!canPrev}
            className="border-none bg-transparent px-2 py-1 text-sm text-text-dim disabled:text-text-quiet disabled:cursor-default cursor-pointer hover:text-text-primary"
            aria-label="Previous week"
          >
            ◀
          </button>

          <div className="text-center min-w-[260px]">
            <div className="text-xs font-semibold text-text-primary font-sans">
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
            className="border-none bg-transparent px-2 py-1 text-sm text-text-dim disabled:text-text-quiet disabled:cursor-default cursor-pointer hover:text-text-primary"
            aria-label="Next week"
          >
            ▶
          </button>

          <button
            onClick={() => setShowPicker(!showPicker)}
            className="border-none bg-transparent px-2 py-1 text-[15px] text-text-muted cursor-pointer hover:text-text-primary"
            aria-label="Open week picker"
          >
            📅
          </button>
        </div>

        {/* Quick-jump buttons */}
        <div className="flex gap-1.5 justify-center mt-1.5 flex-wrap">
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
                const inaugWeek = allWeeks.find((w) => w.week_start === '2025-01-19');
                if (inaugWeek) navigateTo(inaugWeek.week_id);
              }}
            />
          )}
        </div>

        {/* Dropdown picker */}
        {showPicker && (
          <div className="mt-2 bg-surface-raised border border-surface-border rounded p-2 max-h-[200px] overflow-y-auto">
            <div className="text-[9px] text-text-dim font-sans font-semibold tracking-[2px] uppercase mb-1">
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
                  className={`px-2 py-1 cursor-pointer text-[13px] font-sans mb-px flex justify-between ${
                    selected
                      ? 'bg-surface-overlay text-text-primary font-bold'
                      : 'text-text-secondary hover:bg-surface-overlay'
                  }`}
                >
                  <span>
                    Wk {getWeekNum(w.week_start)}: {formatShort(w.week_start)} –{' '}
                    {formatFull(w.week_end)}
                  </span>
                  {isLive && (
                    <span className="text-action text-[11px] font-bold">LIVE</span>
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
      className={`px-2 py-0.5 text-[10px] font-sans cursor-pointer border-none bg-transparent ${
        active
          ? 'text-text-primary font-semibold'
          : 'text-text-muted hover:text-text-primary'
      }`}
    >
      {label}
    </button>
  );
}
