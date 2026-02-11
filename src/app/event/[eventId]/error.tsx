'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function EventError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Event page error:', error);
  }, [error]);

  return (
    <div className="min-h-screen">
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
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-extrabold text-text-primary font-serif mb-1.5">
            Event couldn&apos;t be loaded
          </h2>
          <p className="text-[12px] text-text-dim leading-relaxed mb-4">
            There was a problem loading this event&apos;s details. The data may
            be temporarily unavailable.
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
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
