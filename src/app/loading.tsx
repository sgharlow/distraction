export default function RootLoading() {
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

      {/* Stats bar skeleton */}
      <div className="max-w-[1200px] mx-auto px-4 py-3">
        <div className="flex gap-3 flex-wrap">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-10 w-28 bg-surface-raised border border-surface-border rounded-md animate-pulse"
            />
          ))}
        </div>
      </div>

      {/* Three-column card grid skeleton */}
      <div className="max-w-[1200px] mx-auto px-4 py-2.5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {/* Column A */}
          <div className="space-y-2">
            <div className="h-4 w-24 bg-damage/10 rounded animate-pulse mb-2" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-damage/[0.02] border border-damage/[0.06] rounded-md p-3"
              >
                <div className="h-2.5 w-12 bg-damage/10 rounded animate-pulse mb-2" />
                <div className="h-4 w-full bg-surface-border/50 rounded animate-pulse mb-1.5" />
                <div className="h-3 w-2/3 bg-surface-border/30 rounded animate-pulse" />
              </div>
            ))}
          </div>
          {/* Column B */}
          <div className="space-y-2">
            <div className="h-4 w-24 bg-distraction/10 rounded animate-pulse mb-2" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-distraction/[0.02] border border-distraction/[0.06] rounded-md p-3"
              >
                <div className="h-2.5 w-12 bg-distraction/10 rounded animate-pulse mb-2" />
                <div className="h-4 w-full bg-surface-border/50 rounded animate-pulse mb-1.5" />
                <div className="h-3 w-2/3 bg-surface-border/30 rounded animate-pulse" />
              </div>
            ))}
          </div>
          {/* Column C */}
          <div className="space-y-2">
            <div className="h-4 w-24 bg-noise/10 rounded animate-pulse mb-2" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-noise/[0.02] border border-noise/[0.06] rounded-md p-3"
              >
                <div className="h-2.5 w-12 bg-noise/10 rounded animate-pulse mb-2" />
                <div className="h-4 w-full bg-surface-border/50 rounded animate-pulse mb-1.5" />
                <div className="h-3 w-2/3 bg-surface-border/30 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
