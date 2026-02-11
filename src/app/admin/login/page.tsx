'use client';

import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from './actions';

export default function AdminLoginPage() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/admin';

  const [state, formAction, pending] = useActionState(
    async (_prev: { error: string } | null, formData: FormData) => {
      const result = await signIn(formData);
      return result ?? null;
    },
    null,
  );

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm bg-surface-raised border border-surface-border rounded-lg p-8">
        <h1 className="text-xl font-bold text-text-primary mb-1">Admin Login</h1>
        <p className="text-xs text-text-muted mb-6">The Distraction Index</p>

        {state?.error && (
          <div className="bg-damage/10 border border-damage/30 text-damage text-sm rounded px-3 py-2 mb-4">
            {state.error}
          </div>
        )}

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />

          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-secondary">Email</span>
            <input
              type="email"
              name="email"
              required
              autoFocus
              className="bg-surface-base border border-surface-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-mixed"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-secondary">Password</span>
            <input
              type="password"
              name="password"
              required
              className="bg-surface-base border border-surface-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-mixed"
            />
          </label>

          <button
            type="submit"
            disabled={pending}
            className="bg-mixed text-white rounded px-4 py-2 text-sm font-semibold hover:bg-mixed/90 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {pending ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
