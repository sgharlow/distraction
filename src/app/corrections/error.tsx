'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function CorrectionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Corrections page error:', error);
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
                d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
              />
            </svg>
          </div>
          <h2 className="text-lg font-extrabold text-text-primary font-serif mb-1.5">
            Corrections page couldn&apos;t be loaded
          </h2>
          <p className="text-[12px] text-text-dim leading-relaxed mb-4">
            There was a problem loading this page. The data may be temporarily
            unavailable.
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
