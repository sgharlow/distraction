import Link from 'next/link';
import { LogoutButton } from './logout-button';

const navItems = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/events', label: 'Events' },
  { href: '/admin/weeks', label: 'Weeks' },
  { href: '/admin/queue', label: 'Review Queue' },
  { href: '/admin/pipeline', label: 'Pipeline' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-surface-raised border-r border-surface-border flex flex-col">
        <div className="p-4 border-b border-surface-border">
          <Link href="/admin" className="no-underline">
            <h1 className="text-sm font-bold text-text-primary">Admin</h1>
            <p className="text-[10px] text-text-dim">Distraction Index</p>
          </Link>
        </div>

        <nav className="flex-1 p-2 flex flex-col gap-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-2 rounded text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors no-underline"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-surface-border flex flex-col gap-2">
          <Link
            href="/week/current"
            className="text-xs text-text-dim hover:text-text-secondary transition-colors no-underline"
          >
            View Public Site
          </Link>
          <LogoutButton />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
