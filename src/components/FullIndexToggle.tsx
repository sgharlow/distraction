'use client';

import { useState } from 'react';

interface FullIndexToggleProps {
  children: React.ReactNode;
}

export function FullIndexToggle({ children }: FullIndexToggleProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-2.5">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[9.5px] font-bold uppercase tracking-widest text-text-muted">
          Full Index
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="md:hidden text-[10px] px-2 py-1 rounded border border-surface-border text-text-dim hover:text-text-muted transition-colors cursor-pointer bg-transparent"
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>
      <div className={`${expanded ? 'block' : 'hidden'} md:block`}>
        {children}
      </div>
    </div>
  );
}
