'use client';

import { useState, useCallback, useEffect } from 'react';

interface ShareButtonsProps {
  url: string;
  title: string;
  description?: string;
}

export function ShareButtons({ url, title, description }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [hasWebShare, setHasWebShare] = useState(false);

  // Check for Web Share API on mount (client-side only)
  useEffect(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      setHasWebShare(true);
    }
  }, []);

  const fullUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${url}`
    : url;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: do nothing
    }
  }, [fullUrl]);

  const handleWebShare = useCallback(async () => {
    try {
      await navigator.share({ title, text: description, url: fullUrl });
    } catch {
      // User cancelled or not supported
    }
  }, [title, description, fullUrl]);

  const tweetUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(fullUrl)}`;

  const btnClass = 'bg-transparent border border-surface-border text-text-dim text-[10px] px-2.5 py-1 rounded hover:text-text-muted hover:border-surface-border-light transition-colors cursor-pointer';

  return (
    <div className="flex gap-1.5 items-center">
      <a
        href={tweetUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${btnClass} no-underline`}
      >
        Share on X
      </a>
      <button onClick={handleCopy} className={btnClass}>
        {copied ? 'Copied!' : 'Copy Link'}
      </button>
      {hasWebShare && (
        <button onClick={handleWebShare} className={btnClass}>
          Share...
        </button>
      )}
    </div>
  );
}
