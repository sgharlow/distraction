export default function WeekLoading() {
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

      {/* Week selector skeleton */}
      <div className="max-w-[1200px] mx-auto px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-surface-border/40 rounded animate-pulse" />
          <div className="h-5 w-32 bg-surface-border rounded animate-pulse" />
          <div className="h-8 w-8 bg-surface-border/40 rounded animate-pulse" />
        </div>
      </div>

      {/* Stats bar skeleton */}
      <div className="max-w-[1200px] mx-auto px-4 py-2">
        <div className="flex gap-3 flex-wrap">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-10 w-24 bg-surface-raised border border-surface-border rounded-md animate-pulse"
            />
          ))}
        </div>
      </div>

      {/* Narrative strips skeleton */}
      <div className="max-w-[1200px] mx-auto px-4 py-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-4">
          <div className="bg-damage/[0.03] border border-damage/[0.08] rounded-md p-3 h-24 animate-pulse" />
          <div className="bg-distraction/[0.03] border border-distraction/[0.08] rounded-md p-3 h-24 animate-pulse" />
        </div>
      </div>

      {/* Three-column card grid skeleton */}
      <div className="max-w-[1200px] mx-auto px-4 py-2.5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {(['damage', 'distraction', 'noise'] as const).map((color) => (
            <div key={color} className="space-y-2">
              <div className={`h-4 w-24 bg-${color}/10 rounded animate-pulse mb-2`} />
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className={`bg-${color}/[0.02] border border-${color}/[0.06] rounded-md p-3`}
                >
                  <div className={`h-2.5 w-12 bg-${color}/10 rounded animate-pulse mb-2`} />
                  <div className="h-4 w-full bg-surface-border/50 rounded animate-pulse mb-1.5" />
                  <div className="h-3 w-2/3 bg-surface-border/30 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
