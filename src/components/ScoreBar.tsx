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
  const clamped = Math.min(max, Math.max(0, value));
  const pct = max > 0 ? (clamped / max) * 100 : 0;
  const classes = colorMap[color];
  const [bgClass, textClass] = classes.split(' ');

  return (
    <div className="mb-1">
      <div className="flex justify-between mb-px">
        <span className="font-serif text-[13px] text-text-secondary">{label}</span>
        {weight != null && (
          <span className="font-sans text-[11px] text-text-dim">&times;{weight}</span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex-1 h-1 bg-surface-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${bgClass}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`font-sans text-[11px] font-bold min-w-[24px] text-right ${textClass}`}>
          {clamped.toFixed(1)}/{max}
        </span>
      </div>
    </div>
  );
}
