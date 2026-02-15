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
      <div className="bg-surface-raised border border-surface-border rounded-md p-5 text-center">
        <div className="text-[12px] font-extrabold text-mixed tracking-widest mb-1">
          MESSAGE SENT
        </div>
        <p className="text-sm text-text-secondary m-0">
          Thanks for reaching out. We&apos;ll get back to you soon.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="contact-name" className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1">
          Name
        </label>
        <input
          id="contact-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          className="w-full bg-surface-base border border-surface-border-light rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-dim outline-none focus:border-mixed/50"
          placeholder="Your name"
        />
      </div>
      <div>
        <label htmlFor="contact-email" className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1">
          Email
        </label>
        <input
          id="contact-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full bg-surface-base border border-surface-border-light rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-dim outline-none focus:border-mixed/50"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label htmlFor="contact-message" className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1">
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
          className="w-full bg-surface-base border border-surface-border-light rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-dim outline-none focus:border-mixed/50 resize-y"
          placeholder="Your message..."
        />
      </div>

      {status === 'error' && (
        <p className="text-[12px] text-damage m-0">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="bg-mixed/20 border border-mixed/30 text-mixed text-[12.5px] font-bold tracking-wider px-4 py-2 rounded hover:bg-mixed/30 disabled:opacity-50 transition-colors"
      >
        {status === 'submitting' ? 'SENDING...' : 'SEND MESSAGE'}
      </button>
    </form>
  );
}
