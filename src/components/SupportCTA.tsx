import Link from 'next/link';

export function SupportCTA() {
  return (
    <div className="max-w-[600px] mx-auto px-5 py-4 text-center">
      <div className="bg-surface-overlay rounded-[6px] p-3.5">
        <div className="font-sans text-[9px] font-semibold tracking-[2px] uppercase text-text-dim mb-1">
          Support This Project
        </div>
        <p className="font-serif text-xs text-text-secondary mb-3 m-0">
          The Distraction Index is free, open-source, and ad-free. If you find it
          useful, consider supporting its development.
        </p>
        <div className="flex gap-2 justify-center flex-wrap">
          <a
            href="https://ko-fi.com/distractionindex"
            target="_blank"
            rel="noopener noreferrer"
            className="font-sans bg-text-primary text-surface-base text-[11px] font-semibold px-4 py-1.5 rounded-[3px] hover:opacity-85 transition-opacity no-underline"
          >
            KO-FI
          </a>
          <a
            href="https://github.com/sponsors/sgharlow"
            target="_blank"
            rel="noopener noreferrer"
            className="font-sans bg-text-primary text-surface-base text-[11px] font-semibold px-4 py-1.5 rounded-[3px] hover:opacity-85 transition-opacity no-underline"
          >
            GITHUB SPONSORS
          </a>
          <Link
            href="/support"
            className="font-sans border border-surface-border text-[11px] font-semibold text-text-dim px-4 py-1.5 rounded-[3px] hover:text-text-primary hover:border-text-dim transition-colors no-underline"
          >
            LEARN MORE
          </Link>
        </div>
      </div>
    </div>
  );
}
