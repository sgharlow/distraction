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
    <div className="bg-surface-overlay border-b border-surface-border">
      <div className="max-w-[900px] mx-auto px-5 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-sans text-[9px] font-semibold uppercase tracking-[2px] text-mixed mb-1">
              What is the Distraction Index?
            </div>
            <p className="font-serif text-[13px] text-text-secondary leading-relaxed m-0">
              Every event gets two scores: <strong className="text-damage">Damage</strong> measures
              real constitutional damage (institutional erosion, rule-of-law threats),
              while <strong className="text-distraction">Hype</strong> measures manufactured media
              hype and distraction potential. Events land on the <strong className="text-damage">Damage</strong> list,
              the <strong className="text-distraction">Hype</strong> list,
              or <strong className="text-noise">Noise</strong> based on which score dominates.
              {' '}
              <Link href="/methodology" className="text-text-primary underline hover:text-damage">
                Full methodology
              </Link>
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="font-sans text-[10px] px-2.5 py-1 rounded-[3px] border border-surface-border text-text-dim hover:text-text-primary hover:border-text-dim transition-colors cursor-pointer bg-transparent whitespace-nowrap"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
