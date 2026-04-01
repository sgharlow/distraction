export default function EventLoading() {
  return (
    <div className="min-h-screen">
      {/* TopNav skeleton */}
      <header className="border-b border-surface-border pb-2.5 pt-3 px-5">
        <div className="max-w-[900px] mx-auto flex items-center justify-between gap-2.5">
          <div className="flex items-baseline gap-2.5">
            <div className="h-8 w-8 bg-surface-border rounded-[3px] animate-pulse" />
            <div className="h-4 w-36 bg-surface-border/60 rounded-[3px] animate-pulse" />
          </div>
          <div className="hidden md:flex gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-3 w-12 bg-surface-border/40 rounded-[3px] animate-pulse" />
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-[900px] mx-auto px-5 py-5">
        {/* Back link skeleton */}
        <div className="h-3 w-24 bg-surface-border/30 rounded-[3px] animate-pulse mb-3" />

        {/* Header skeleton */}
        <div className="mb-4">
          <div className="flex gap-1.5 items-center mb-1">
            <div className="h-3 w-16 bg-surface-border/40 rounded-[3px] animate-pulse" />
            <div className="h-3 w-12 bg-surface-border/30 rounded-[3px] animate-pulse" />
          </div>
          <div className="h-6 w-full bg-surface-border rounded-[3px] animate-pulse mb-1" />
          <div className="h-6 w-2/3 bg-surface-border/70 rounded-[3px] animate-pulse mb-1.5" />
          <div className="h-3 w-48 bg-surface-border/40 rounded-[3px] animate-pulse mb-2" />
          <div className="flex gap-1 flex-wrap">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-5 w-16 bg-surface-overlay rounded-[2px] animate-pulse" />
            ))}
          </div>
        </div>

        {/* Dual score skeleton */}
        <div className="mb-4">
          <div className="h-12 w-40 bg-surface-border/40 rounded-[3px] animate-pulse mb-1" />
          <div className="h-4 w-full bg-surface-border/20 rounded-[3px] animate-pulse" />
        </div>

        {/* Summary skeleton */}
        <div className="bg-surface-overlay rounded-[6px] p-3 mb-3">
          <div className="h-3 w-16 bg-surface-border/40 rounded-[3px] animate-pulse mb-2" />
          <div className="space-y-1.5">
            <div className="h-3 w-full bg-surface-border/30 rounded-[3px] animate-pulse" />
            <div className="h-3 w-full bg-surface-border/30 rounded-[3px] animate-pulse" />
            <div className="h-3 w-4/5 bg-surface-border/25 rounded-[3px] animate-pulse" />
          </div>
        </div>

        {/* Score rationale skeleton */}
        <div className="bg-surface-overlay border border-surface-border rounded-[6px] p-3 mb-3">
          <div className="h-3 w-24 bg-surface-border/40 rounded-[3px] animate-pulse mb-2" />
          <div className="space-y-1.5">
            <div className="h-3 w-full bg-surface-border/25 rounded-[3px] animate-pulse" />
            <div className="h-3 w-3/4 bg-surface-border/20 rounded-[3px] animate-pulse" />
          </div>
        </div>

        {/* Score bars skeleton */}
        <div className="bg-damage-light border border-surface-border rounded-[6px] p-3 mb-2">
          <div className="h-3 w-28 bg-damage/10 rounded-[3px] animate-pulse mb-2" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 mb-1.5">
              <div className="h-3 w-24 bg-surface-border/30 rounded-[3px] animate-pulse shrink-0" />
              <div className="h-3 flex-1 bg-damage/10 rounded-[3px] animate-pulse" />
            </div>
          ))}
        </div>

        {/* Sources skeleton */}
        <div className="bg-surface-overlay rounded-[6px] p-2.5 mb-2">
          <div className="h-3 w-20 bg-surface-border/40 rounded-[3px] animate-pulse mb-2" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-3 w-full bg-surface-border/20 rounded-[3px] animate-pulse mb-1" />
          ))}
        </div>
      </main>
    </div>
  );
}
