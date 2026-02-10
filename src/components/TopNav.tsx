import Link from 'next/link';

export function TopNav() {
  return (
    <header className="border-b border-surface-border py-2.5 px-4">
      <div className="max-w-[1200px] mx-auto flex items-center justify-between flex-wrap gap-1.5">
        <div>
          <Link href="/week/current" className="no-underline">
            <h1 className="text-xl font-black text-text-primary font-serif m-0 leading-tight">
              The Distraction Index
            </h1>
          </Link>
          <p className="text-[9.5px] text-text-dim m-0">
            Weekly civic intelligence report &middot; v2.2
          </p>
        </div>
        <nav className="flex gap-0.5 flex-wrap">
          <NavLink href="/week/current" label="Dashboard" />
          <NavLink href="/undercovered" label="Undercovered" />
          <NavLink href="/smokescreen" label="Smokescreen" />
          <NavLink href="/methodology" label="Method" />
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="px-2.5 py-1 rounded border border-surface-border text-[10.5px] font-semibold text-text-dim hover:text-mixed hover:border-mixed/25 transition-colors no-underline"
    >
      {label}
    </Link>
  );
}
