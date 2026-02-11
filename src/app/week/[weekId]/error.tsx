'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function WeekError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Week page error:', error);
  }, [error]);

  return (
    <div className="min-h-screen">
      {/* Minimal nav */}
      <header className="border-b border-surface-border py-2.5 px-4">
        <div className="max-w-[1200px] mx-auto">
          <Link href="/week/current" className="no-underline">
            <h1 className="text-xl font-black text-text-primary font-serif m-0 leading-tight">
              The Distraction Index
            </h1>
          </Link>
        </div>
      </header>

      <div className="flex items-center justify-center px-4 py-20">
        <div className="max-w-[420px] text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-damage/10 border border-damage/20 mb-4">
            <svg
              className="w-5 h-5 text-damage"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
              />
            </svg>
          </div>
          <h2 className="text-lg font-extrabold text-text-primary font-serif mb-1.5">
            This week couldn&apos;t be loaded
          </h2>
          <p className="text-[12px] text-text-dim leading-relaxed mb-4">
            There was a problem loading the weekly dashboard. The data may be
            temporarily unavailable.
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={reset}
              className="px-4 py-2 bg-mixed/10 border border-mixed/20 rounded-md text-[12px] font-semibold text-mixed hover:bg-mixed/20 transition-colors cursor-pointer"
            >
              Try again
            </button>
            <Link
              href="/week/current"
              className="px-4 py-2 border border-surface-border rounded-md text-[12px] font-semibold text-text-dim hover:text-text-muted hover:border-surface-border-light transition-colors no-underline"
            >
              Current week
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
