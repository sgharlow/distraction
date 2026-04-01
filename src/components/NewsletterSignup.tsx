'use client';

import { useState } from 'react';
import Link from 'next/link';

type Status = 'idle' | 'submitting' | 'subscribed' | 'already_subscribed' | 'error';

export function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || status === 'submitting') return;

    setStatus('submitting');
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();

      if (data.status === 'subscribed' || data.status === 'already_subscribed') {
        setStatus(data.status);
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  if (status === 'subscribed') {
    return (
      <div className="max-w-[600px] mx-auto px-5 py-6 text-center">
        <div className="bg-surface-overlay rounded-[6px] p-3.5">
          <div className="font-sans text-[9px] font-semibold tracking-[2px] uppercase text-action mb-1">
            You&apos;re in
          </div>
          <p className="font-serif text-xs text-text-secondary m-0">
            You&apos;re on the list. We&apos;ll notify you when the weekly email launches.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'already_subscribed') {
    return (
      <div className="max-w-[600px] mx-auto px-5 py-6 text-center">
        <div className="bg-surface-overlay rounded-[6px] p-3.5">
          <div className="font-sans text-[9px] font-semibold tracking-[2px] uppercase text-action mb-1">
            Already subscribed
          </div>
          <p className="font-serif text-xs text-text-secondary m-0">
            That email is already on the list. You&apos;re all set.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[600px] mx-auto px-5 py-6 text-center">
      <div className="bg-surface-overlay rounded-[6px] p-3.5">
        <div className="font-sans text-[9px] font-semibold tracking-[2px] uppercase text-text-dim mb-1">
          Weekly Briefing
        </div>
        <p className="font-serif text-xs text-text-secondary mb-2 m-0">
          Sign up to receive the Distraction Index when the weekly email launches.
        </p>
        <form onSubmit={handleSubmit} className="flex gap-1.5 justify-center max-w-[360px] mx-auto">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="flex-1 font-sans bg-surface-raised border border-surface-border rounded-[3px] px-3 py-1.5 text-[11px] text-text-primary placeholder:text-text-muted outline-none focus:border-text-dim"
          />
          <button
            type="submit"
            disabled={status === 'submitting'}
            className="font-sans bg-text-primary text-surface-base text-[11px] font-semibold px-3.5 py-1.5 rounded-[3px] border-none cursor-pointer hover:opacity-85 disabled:opacity-50"
          >
            {status === 'submitting' ? 'SENDING...' : 'SUBSCRIBE'}
          </button>
        </form>
        {status === 'error' && (
          <p className="font-sans text-xs text-damage mt-2 m-0">
            Something went wrong. Please try again.
          </p>
        )}
        <p className="font-sans text-[9px] text-text-muted mt-2 m-0">
          No spam, ever. See our <Link href="/privacy" className="text-text-primary hover:underline no-underline">privacy policy</Link>.
        </p>
      </div>
    </div>
  );
}
