import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-[440px] text-center">
        <div className="text-[64px] font-black text-surface-border-light font-mono leading-none mb-2">
          404
        </div>
        <h2 className="text-lg font-extrabold text-text-primary font-serif mb-1.5">
          Page not found
        </h2>
        <p className="text-[12px] text-text-dim leading-relaxed mb-5">
          The page you&apos;re looking for doesn&apos;t exist or may have been
          moved. If you followed a link here, it may be outdated.
        </p>
        <div className="flex gap-2 justify-center flex-wrap">
          <Link
            href="/week/current"
            className="px-4 py-2 bg-mixed/10 border border-mixed/20 rounded-md text-[12px] font-semibold text-mixed hover:bg-mixed/20 transition-colors no-underline"
          >
            Dashboard
          </Link>
          <Link
            href="/timeline"
            className="px-4 py-2 border border-surface-border rounded-md text-[12px] font-semibold text-text-dim hover:text-text-muted hover:border-surface-border-light transition-colors no-underline"
          >
            Timeline
          </Link>
          <Link
            href="/search"
            className="px-4 py-2 border border-surface-border rounded-md text-[12px] font-semibold text-text-dim hover:text-text-muted hover:border-surface-border-light transition-colors no-underline"
          >
            Search
          </Link>
        </div>
      </div>
    </div>
  );
}
