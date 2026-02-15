'use client';

import { useState } from 'react';

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
      <div className="max-w-[600px] mx-auto px-4 py-6 text-center">
        <div className="bg-surface-raised border border-surface-border rounded-md p-5">
          <div className="text-[10px] font-extrabold text-mixed tracking-widest mb-1">
            YOU&apos;RE IN
          </div>
          <p className="text-xs text-text-secondary m-0">
            We&apos;ll send you the Distraction Index every Sunday.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'already_subscribed') {
    return (
      <div className="max-w-[600px] mx-auto px-4 py-6 text-center">
        <div className="bg-surface-raised border border-surface-border rounded-md p-5">
          <div className="text-[10px] font-extrabold text-mixed tracking-widest mb-1">
            ALREADY SUBSCRIBED
          </div>
          <p className="text-xs text-text-secondary m-0">
            That email is already on the list. You&apos;re all set.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[600px] mx-auto px-4 py-6 text-center">
      <div className="bg-surface-raised border border-surface-border rounded-md p-5">
        <div className="text-[10px] font-extrabold text-mixed tracking-widest mb-1">
          WEEKLY BRIEFING — COMING SOON
        </div>
        <p className="text-xs text-text-secondary mb-3 m-0">
          Get the Distraction Index delivered to your inbox every Sunday.
        </p>
        <form onSubmit={handleSubmit} className="flex gap-2 justify-center max-w-[360px] mx-auto">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="flex-1 bg-surface-base border border-surface-border-light rounded px-3 py-1.5 text-xs text-text-primary placeholder:text-text-dim outline-none focus:border-mixed/50"
          />
          <button
            type="submit"
            disabled={status === 'submitting'}
            className="bg-mixed/20 border border-mixed/30 text-mixed text-[10px] font-bold tracking-wider px-3 py-1.5 rounded hover:bg-mixed/30 disabled:opacity-50 transition-colors"
          >
            {status === 'submitting' ? 'SENDING...' : 'SUBSCRIBE'}
          </button>
        </form>
        {status === 'error' && (
          <p className="text-[10px] text-damage mt-2 m-0">
            Something went wrong. Please try again.
          </p>
        )}
      </div>
    </div>
  );
}
