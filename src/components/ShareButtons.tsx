'use client';

import { useState, useCallback, useEffect } from 'react';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://distractionindex.org';

interface ShareButtonsProps {
  url: string;
  title: string;
  description?: string;
}

export function ShareButtons({ url, title, description }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [hasWebShare, setHasWebShare] = useState(false);
  const [origin, setOrigin] = useState(SITE_URL);

  // Check for Web Share API on mount (client-side only)
  useEffect(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      setHasWebShare(true);
    }
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const fullUrl = `${origin}${url}`;

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

  const btnClass = 'bg-white/[0.04] border border-surface-border text-text-muted text-[12px] px-2.5 py-1 rounded hover:text-text-primary hover:border-surface-border-light transition-colors cursor-pointer';

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
