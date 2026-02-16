import Link from 'next/link';

export function SupportCTA() {
  return (
    <div className="max-w-[600px] mx-auto px-4 py-4 text-center">
      <div className="bg-surface-raised border border-surface-border rounded-md p-5">
        <div className="text-[12px] font-extrabold text-mixed tracking-widest mb-1">
          SUPPORT THIS PROJECT
        </div>
        <p className="text-sm text-text-secondary mb-3 m-0">
          The Distraction Index is free, open-source, and ad-free. If you find it
          useful, consider supporting its development.
        </p>
        <div className="flex gap-2 justify-center flex-wrap">
          <a
            href="https://ko-fi.com/distractionindex"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-mixed/20 border border-mixed/30 text-mixed text-[12px] font-bold tracking-wider px-4 py-1.5 rounded hover:bg-mixed/30 transition-colors no-underline"
          >
            KO-FI
          </a>
          <a
            href="https://github.com/sponsors/sgharlow"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-mixed/20 border border-mixed/30 text-mixed text-[12px] font-bold tracking-wider px-4 py-1.5 rounded hover:bg-mixed/30 transition-colors no-underline"
          >
            GITHUB SPONSORS
          </a>
          <Link
            href="/support"
            className="border border-surface-border bg-white/[0.04] text-[12px] font-bold tracking-wider text-text-muted px-4 py-1.5 rounded hover:text-mixed hover:border-mixed/25 transition-colors no-underline"
          >
            LEARN MORE
          </Link>
        </div>
      </div>
    </div>
  );
}
