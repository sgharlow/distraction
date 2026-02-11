'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function TopicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Topic page error:', error);
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
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-mixed/10 border border-mixed/20 mb-4">
            <svg
              className="w-5 h-5 text-mixed"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5-3.9 19.5m-2.1-19.5-3.9 19.5"
              />
            </svg>
          </div>
          <h2 className="text-lg font-extrabold text-text-primary font-serif mb-1.5">
            Topic couldn&apos;t be loaded
          </h2>
          <p className="text-[12px] text-text-dim leading-relaxed mb-4">
            There was a problem loading events for this topic. The data may be
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
              href="/topic"
              className="px-4 py-2 border border-surface-border rounded-md text-[12px] font-semibold text-text-dim hover:text-text-muted hover:border-surface-border-light transition-colors no-underline"
            >
              All topics
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
