export default function TopicLoading() {
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

      <main className="max-w-[860px] mx-auto px-4 py-6">
        {/* Topic heading skeleton */}
        <div className="mb-4">
          <div className="h-6 w-40 bg-surface-border rounded animate-pulse mb-1" />
          <div className="h-3 w-52 bg-surface-border/50 rounded animate-pulse" />
        </div>

        {/* Stat chips skeleton */}
        <div className="flex gap-3 mb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-4 w-16 bg-surface-border/40 rounded animate-pulse"
            />
          ))}
        </div>

        {/* Event list skeleton grouped by week */}
        {Array.from({ length: 3 }).map((_, weekIdx) => (
          <div key={weekIdx} className="mb-4">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-3 w-16 bg-surface-border/40 rounded animate-pulse" />
              <div className="h-3 w-24 bg-surface-border/30 rounded animate-pulse" />
              <div className="flex-1 border-t border-surface-border" />
            </div>
            <div className="space-y-1">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white/[0.01] border border-surface-border rounded-md p-2.5"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="h-2.5 w-10 bg-surface-border/40 rounded animate-pulse" />
                        <div className="h-2.5 w-16 bg-surface-border/30 rounded animate-pulse" />
                      </div>
                      <div className="h-4 w-full bg-surface-border/50 rounded animate-pulse mb-1" />
                      <div className="h-3 w-1/2 bg-surface-border/30 rounded animate-pulse" />
                    </div>
                    <div className="w-[80px] shrink-0">
                      <div className="h-8 w-full bg-surface-border/30 rounded animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
