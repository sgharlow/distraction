'use client';

import { useEffect } from 'react';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Root error boundary caught:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
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
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>
        <h2 className="text-lg font-extrabold text-text-primary font-serif mb-1.5">
          Something went wrong
        </h2>
        <p className="text-[12px] text-text-dim leading-relaxed mb-4">
          An unexpected error occurred while loading this page. This has been
          logged and we&apos;ll look into it.
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-mixed/10 border border-mixed/20 rounded-md text-[12px] font-semibold text-mixed hover:bg-mixed/20 transition-colors cursor-pointer"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
