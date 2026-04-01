'use client';

import { useState } from 'react';

type Status = 'idle' | 'submitting' | 'sent' | 'error';

export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'submitting') return;

    setStatus('submitting');
    setErrorMsg('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
        }),
      });
      const data = await res.json();

      if (data.status === 'sent') {
        setStatus('sent');
      } else {
        setErrorMsg(data.message || 'Something went wrong.');
        setStatus('error');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div className="bg-surface-overlay border border-surface-border rounded-[6px] p-5 text-center">
        <div className="font-sans text-[9px] font-semibold tracking-[2px] uppercase text-action mb-1">
          Message Sent
        </div>
        <p className="font-serif text-sm text-text-secondary m-0">
          Thanks for reaching out. We&apos;ll get back to you soon.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-[500px]">
      <div>
        <label htmlFor="contact-name" className="block font-sans text-[9px] font-semibold text-text-dim uppercase tracking-[2px] mb-1">
          Name
        </label>
        <input
          id="contact-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          className="w-full font-sans bg-surface-raised border border-surface-border rounded-[3px] px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-text-dim"
          placeholder="Your name"
        />
      </div>
      <div>
        <label htmlFor="contact-email" className="block font-sans text-[9px] font-semibold text-text-dim uppercase tracking-[2px] mb-1">
          Email
        </label>
        <input
          id="contact-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full font-sans bg-surface-raised border border-surface-border rounded-[3px] px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-text-dim"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label htmlFor="contact-message" className="block font-sans text-[9px] font-semibold text-text-dim uppercase tracking-[2px] mb-1">
          Message
        </label>
        <textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
          maxLength={5000}
          rows={5}
          className="w-full font-sans bg-surface-raised border border-surface-border rounded-[3px] px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-text-dim resize-y"
          placeholder="Your message..."
        />
      </div>

      {status === 'error' && (
        <p className="font-sans text-xs text-damage m-0">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="font-sans bg-text-primary text-surface-base text-[11px] font-semibold px-4 py-2 rounded-[3px] border-none cursor-pointer hover:opacity-85 disabled:opacity-50"
      >
        {status === 'submitting' ? 'SENDING...' : 'SEND MESSAGE'}
      </button>
    </form>
  );
}
