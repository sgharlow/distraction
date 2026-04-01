'use client';

import { useState } from 'react';

interface FullIndexToggleProps {
  children: React.ReactNode;
}

export function FullIndexToggle({ children }: FullIndexToggleProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="max-w-[900px] mx-auto px-5 py-2.5">
      <div className="flex items-baseline justify-between mb-2 border-b-2 border-border-heavy pb-1">
        <span className="font-sans text-[9px] font-semibold tracking-[2px] uppercase text-text-dim">
          Full Index
        </span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="md:hidden font-sans text-[10px] text-text-dim hover:text-text-primary transition-colors cursor-pointer bg-transparent border-none"
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
