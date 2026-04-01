'use client';

import { useState } from 'react';
import Link from 'next/link';

export function TopNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="border-b border-surface-border pb-2.5 pt-3 px-5">
      <div className="max-w-[900px] mx-auto flex items-baseline justify-between gap-2.5 flex-wrap">
        <Link href="/week/current" className="no-underline shrink-0 flex items-baseline gap-2.5">
          <span className="font-serif text-4xl font-bold leading-none tracking-[-2px] text-text-primary">
            DI
          </span>
          <span className="font-sans text-sm font-bold tracking-[-0.3px] text-text-primary">
            The Distraction Index
          </span>
        </Link>

        {/* Hamburger button — visible only on mobile */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden flex flex-col gap-[3px] p-1.5 cursor-pointer bg-transparent border-none"
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
        >
          <span className={`block w-4 h-[2px] bg-text-dim transition-transform ${menuOpen ? 'rotate-45 translate-y-[5px]' : ''}`} />
          <span className={`block w-4 h-[2px] bg-text-dim transition-opacity ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`block w-4 h-[2px] bg-text-dim transition-transform ${menuOpen ? '-rotate-45 -translate-y-[5px]' : ''}`} />
        </button>

        {/* Desktop nav */}
        <nav className="hidden md:flex gap-2.5 font-sans text-[10px]">
          <NavLink href="/week/current" label="Dashboard" />
          <NavLink href="/undercovered" label="Undercovered" />
          <NavLink href="/smokescreen" label="Smokescreen" />
          <NavLink href="/timeline" label="Timeline" />
          <NavLink href="/topic" label="Topics" />
          <NavLink href="/search" label="Search" />
          <NavLink href="/methodology" label="Method" />
          <NavLink href="/corrections" label="Corrections" />
          <NavLink href="/about" label="About" />
          <NavLink href="/blog" label="Blog" />
          <NavLink href="/contact" label="Contact" />
          <NavLink href="/support" label="Support" />
        </nav>
      </div>

      {/* Mobile nav dropdown */}
      {menuOpen && (
        <nav className="md:hidden flex flex-col gap-1 mt-2 pt-2 border-t border-surface-border font-sans text-[10px]">
          <NavLink href="/week/current" label="Dashboard" onClick={() => setMenuOpen(false)} />
          <NavLink href="/undercovered" label="Undercovered" onClick={() => setMenuOpen(false)} />
          <NavLink href="/smokescreen" label="Smokescreen" onClick={() => setMenuOpen(false)} />
          <NavLink href="/timeline" label="Timeline" onClick={() => setMenuOpen(false)} />
          <NavLink href="/topic" label="Topics" onClick={() => setMenuOpen(false)} />
          <NavLink href="/search" label="Search" onClick={() => setMenuOpen(false)} />
          <NavLink href="/methodology" label="Method" onClick={() => setMenuOpen(false)} />
          <NavLink href="/corrections" label="Corrections" onClick={() => setMenuOpen(false)} />
          <NavLink href="/about" label="About" onClick={() => setMenuOpen(false)} />
          <NavLink href="/blog" label="Blog" onClick={() => setMenuOpen(false)} />
          <NavLink href="/contact" label="Contact" onClick={() => setMenuOpen(false)} />
          <NavLink href="/support" label="Support" onClick={() => setMenuOpen(false)} />
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
      className="text-text-dim hover:text-text-primary transition-colors no-underline py-0.5"
    >
      {label}
    </Link>
  );
}
