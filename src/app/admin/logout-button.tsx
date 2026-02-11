'use client';

import { signOut } from './login/actions';

export function LogoutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="text-xs text-text-dim hover:text-damage transition-colors cursor-pointer bg-transparent border-none p-0"
      >
        Sign Out
      </button>
    </form>
  );
}
