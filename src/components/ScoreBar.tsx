interface ScoreBarProps {
  label: string;
  value: number;
  max?: number;
  color: 'damage' | 'distraction' | 'noise' | 'mixed';
  weight?: number;
}

const colorMap = {
  damage: 'bg-damage text-damage',
  distraction: 'bg-distraction text-distraction',
  noise: 'bg-noise text-noise',
  mixed: 'bg-mixed text-mixed',
};

export function ScoreBar({ label, value, max = 5, color, weight }: ScoreBarProps) {
  // Clamp displayed value to [0, max] so bars render correctly even with unclamped DB data
  const clamped = Math.min(max, Math.max(0, value));
  const pct = max > 0 ? (clamped / max) * 100 : 0;
  const classes = colorMap[color];
  const [bgClass, textClass] = classes.split(' ');

  return (
    <div className="mb-1">
      <div className="flex justify-between mb-px">
        <span className="text-[13px] text-text-secondary">{label}</span>
        {weight != null && (
          <span className="text-[11.5px] text-text-dim font-mono">&times;{weight}</span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex-1 h-1 bg-surface-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${bgClass}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`text-[12px] font-bold min-w-[24px] text-right font-mono ${textClass}`}>
          {clamped.toFixed(1)}/{max}
        </span>
      </div>
    </div>
  );
}
