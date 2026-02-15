'use client';

import { useState } from 'react';
import Link from 'next/link';

export function TopNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="border-b border-surface-border py-2.5 px-4">
      <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-1.5">
        <div>
          <Link href="/week/current" className="no-underline">
            <h1 className="text-2xl font-black text-text-primary font-serif m-0 leading-tight">
              The Distraction Index
            </h1>
          </Link>
          <p className="text-[11.5px] text-text-dim m-0">
            Weekly civic intelligence report &middot; v2.2
          </p>
        </div>

        {/* Hamburger button — visible only on mobile */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden flex flex-col gap-[3px] p-1.5 rounded border border-surface-border bg-white/[0.04] cursor-pointer"
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
        >
          <span className={`block w-4 h-[2px] bg-text-dim transition-transform ${menuOpen ? 'rotate-45 translate-y-[5px]' : ''}`} />
          <span className={`block w-4 h-[2px] bg-text-dim transition-opacity ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`block w-4 h-[2px] bg-text-dim transition-transform ${menuOpen ? '-rotate-45 -translate-y-[5px]' : ''}`} />
        </button>

        {/* Desktop nav — hidden on mobile */}
        <nav className="hidden md:flex gap-0.5 flex-wrap">
          <NavLink href="/week/current" label="Dashboard" />
          <NavLink href="/undercovered" label="Undercovered" />
          <NavLink href="/smokescreen" label="Smokescreen" />
          <NavLink href="/timeline" label="Timeline" />
          <NavLink href="/topic" label="Topics" />
          <NavLink href="/search" label="Search" />
          <NavLink href="/methodology" label="Method" />
          <NavLink href="/corrections" label="Corrections" />
          <NavLink href="/about" label="About" />
          <NavLink href="/contact" label="Contact" />
        </nav>
      </div>

      {/* Mobile nav dropdown */}
      {menuOpen && (
        <nav className="md:hidden flex flex-col gap-1 mt-2 pt-2 border-t border-surface-border">
          <NavLink href="/week/current" label="Dashboard" onClick={() => setMenuOpen(false)} />
          <NavLink href="/undercovered" label="Undercovered" onClick={() => setMenuOpen(false)} />
          <NavLink href="/smokescreen" label="Smokescreen" onClick={() => setMenuOpen(false)} />
          <NavLink href="/timeline" label="Timeline" onClick={() => setMenuOpen(false)} />
          <NavLink href="/topic" label="Topics" onClick={() => setMenuOpen(false)} />
          <NavLink href="/search" label="Search" onClick={() => setMenuOpen(false)} />
          <NavLink href="/methodology" label="Method" onClick={() => setMenuOpen(false)} />
          <NavLink href="/corrections" label="Corrections" onClick={() => setMenuOpen(false)} />
          <NavLink href="/about" label="About" onClick={() => setMenuOpen(false)} />
          <NavLink href="/contact" label="Contact" onClick={() => setMenuOpen(false)} />
        </nav>
      )}
    </header>
  );
}

function NavLink({ href, label, onClick }: { href: string; label: string; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="px-2.5 py-1 rounded border border-surface-border bg-white/[0.04] text-[12.5px] font-semibold text-text-muted hover:text-mixed hover:border-mixed/25 transition-colors no-underline"
    >
      {label}
    </Link>
  );
}
