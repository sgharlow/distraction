export default function EventLoading() {
  return (
    <div className="min-h-screen">
      {/* TopNav skeleton */}
      <header className="border-b border-surface-border py-2.5 px-4">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-1.5">
          <div>
            <div className="h-6 w-48 bg-surface-border rounded animate-pulse" />
            <div className="h-3 w-56 bg-surface-border/60 rounded animate-pulse mt-1" />
          </div>
          <div className="hidden md:flex gap-0.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-7 w-16 bg-surface-border/40 border border-surface-border rounded animate-pulse"
              />
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-[680px] mx-auto px-4 py-5">
        {/* Back link skeleton */}
        <div className="h-3 w-24 bg-surface-border/30 rounded animate-pulse mb-3" />

        {/* Header skeleton */}
        <div className="mb-4">
          <div className="flex gap-1.5 items-center mb-1">
            <div className="h-3 w-16 bg-surface-border/40 rounded animate-pulse" />
            <div className="h-3 w-12 bg-surface-border/30 rounded animate-pulse" />
          </div>
          <div className="h-6 w-full bg-surface-border rounded animate-pulse mb-1" />
          <div className="h-6 w-2/3 bg-surface-border/70 rounded animate-pulse mb-1.5" />
          <div className="h-3 w-48 bg-surface-border/40 rounded animate-pulse mb-2" />
          <div className="flex gap-1 flex-wrap">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-5 w-16 bg-white/[0.06] rounded animate-pulse"
              />
            ))}
          </div>
        </div>

        {/* Dual score skeleton */}
        <div className="mb-4">
          <div className="h-12 w-40 bg-surface-border/40 rounded-md animate-pulse mb-1" />
          <div className="h-4 w-full bg-surface-border/20 rounded animate-pulse" />
        </div>

        {/* Summary skeleton */}
        <div className="bg-white/[0.03] rounded-md p-3 mb-3">
          <div className="h-3 w-16 bg-surface-border/40 rounded animate-pulse mb-2" />
          <div className="space-y-1.5">
            <div className="h-3 w-full bg-surface-border/30 rounded animate-pulse" />
            <div className="h-3 w-full bg-surface-border/30 rounded animate-pulse" />
            <div className="h-3 w-4/5 bg-surface-border/25 rounded animate-pulse" />
          </div>
        </div>

        {/* Score rationale skeleton */}
        <div className="bg-white/[0.02] border border-surface-border rounded-md p-3 mb-3">
          <div className="h-3 w-24 bg-surface-border/40 rounded animate-pulse mb-2" />
          <div className="space-y-1.5">
            <div className="h-3 w-full bg-surface-border/25 rounded animate-pulse" />
            <div className="h-3 w-3/4 bg-surface-border/20 rounded animate-pulse" />
          </div>
        </div>

        {/* Score bars skeleton */}
        <div className="bg-damage/[0.03] border border-damage/[0.08] rounded-md p-3 mb-2">
          <div className="h-3 w-28 bg-damage/10 rounded animate-pulse mb-2" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 mb-1.5">
              <div className="h-3 w-24 bg-surface-border/30 rounded animate-pulse shrink-0" />
              <div className="h-3 flex-1 bg-damage/[0.06] rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Sources skeleton */}
        <div className="bg-white/[0.02] rounded-md p-2.5 mb-2">
          <div className="h-3 w-20 bg-surface-border/40 rounded animate-pulse mb-2" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-3 w-full bg-surface-border/20 rounded animate-pulse mb-1"
            />
          ))}
        </div>
      </main>
    </div>
  );
}
