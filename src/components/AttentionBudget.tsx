interface AttentionBudgetProps {
  aScore: number | null;
  bScore: number | null;
}

export function AttentionBudget({ aScore, bScore }: AttentionBudgetProps) {
  const a = aScore ?? 0;
  const b = bScore ?? 0;
  const ab = b - a;

  let color: string;
  let label: string;

  if (ab > 30) {
    color = 'text-distraction';
    label = 'DISTRACTION';
  } else if (ab < -30) {
    color = 'text-damage';
    label = 'UNDERCOVERED';
  } else {
    color = 'text-mixed';
    label = 'MIXED';
  }

  return (
    <span className={`text-[9.5px] font-bold tracking-wide ${color}`}>
      {ab > 0 ? '+' : ''}{ab.toFixed(0)} {label}
    </span>
  );
}
