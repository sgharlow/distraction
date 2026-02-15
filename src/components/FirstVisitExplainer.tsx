'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'di-explainer-dismissed';

export function FirstVisitExplainer() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setDismissed(false);
      }
    }
  }, []);

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setDismissed(true);
  };

  return (
    <div className="bg-mixed/[0.03] border-b border-mixed/[0.08]">
      <div className="max-w-[1200px] mx-auto px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[9.5px] font-bold uppercase tracking-widest text-mixed mb-1">
              What is the Distraction Index?
            </div>
            <p className="text-[11.5px] text-text-secondary leading-relaxed m-0">
              Every event gets two scores: <strong className="text-damage">A-score</strong> measures
              real constitutional damage (institutional erosion, rule-of-law threats),
              while <strong className="text-distraction">B-score</strong> measures manufactured media
              hype and distraction potential. Events land on <strong className="text-damage">List A</strong> (real
              damage), <strong className="text-distraction">List B</strong> (distractions),
              or <strong className="text-noise">Noise</strong> based on which score dominates.
              {' '}
              <Link href="/methodology" className="text-mixed hover:underline">
                Full methodology
              </Link>
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-[10px] px-2.5 py-1 rounded border border-mixed/20 text-mixed hover:bg-mixed/10 transition-colors cursor-pointer bg-transparent whitespace-nowrap"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
