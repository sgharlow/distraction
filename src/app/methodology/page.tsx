import type { Metadata } from 'next';
import { TopNav } from '@/components/TopNav';
import { A_DRIVER_KEYS, A_DRIVER_LABELS, A_DRIVER_WEIGHTS, MECHANISM_LABELS, MECHANISM_MODIFIERS } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Methodology',
  description: 'Full algorithmic transparency for The Distraction Index scoring system. How we measure democratic damage and manufactured distractions.',
  openGraph: {
    title: 'Methodology',
    description: 'Full algorithmic transparency for The Distraction Index scoring system. How we measure democratic damage and manufactured distractions.',
    url: '/methodology',
  },
  twitter: {
    card: 'summary',
    title: 'Methodology | The Distraction Index',
    description: 'Full algorithmic transparency. How we score democratic damage vs. manufactured distractions.',
  },
  alternates: {
    canonical: '/methodology',
  },
};

export default function MethodologyPage() {
  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="mx-auto max-w-[820px] px-4 py-6">
        <h1 className="mb-1 font-serif text-xl font-extrabold text-text-primary">
          Methodology v2.2
        </h1>
        <p className="mb-5 text-[13.5px] text-text-muted">Full algorithmic transparency.</p>

        {/* What's new */}
        <section className="bg-live/[0.04] border border-live/15 rounded-lg p-3 mb-3">
          <h2 className="text-[13.5px] font-bold text-live mb-1">New in v2.2 — Weekly Editions</h2>
          <p className="text-[13px] text-text-secondary leading-relaxed m-0">
            The Distraction Index publishes as <strong>weekly editions</strong>. Each week
            (Sunday–Saturday) gets its own immutable snapshot. The current week updates live;
            past weeks are frozen permanently. Within a week, all events compete on raw scores.
            No data is ever changed after the week closes.
          </p>
        </section>

        <div className="space-y-2.5">
          {/* List A */}
          <section className="bg-damage/[0.03] border border-damage/[0.08] rounded-lg p-3">
            <h2 className="text-sm font-bold text-damage mb-1">List A — Constitutional Damage</h2>
            <p className="text-[12.5px] text-text-secondary leading-relaxed mb-3">
              7 weighted drivers scored 0–5, combined with severity multipliers, mechanism modifier,
              and scope modifier.
            </p>
            <div className="font-mono text-[12px] text-damage-light bg-damage/[0.05] rounded p-2 mb-3">
              A = min(100, 100 × Σ(weight × driver / 5) × avg(severity) × mechanism × scope)
            </div>

            <h3 className="text-[12px] font-bold text-damage mb-1.5 uppercase tracking-wider">
              Drivers & Weights
            </h3>
            <div className="space-y-0.5 mb-3">
              {A_DRIVER_KEYS.map((key) => (
                <div key={key} className="flex justify-between text-[12.5px]">
                  <span className="text-text-secondary">{A_DRIVER_LABELS[key]}</span>
                  <span className="text-text-dim font-mono">{A_DRIVER_WEIGHTS[key]}</span>
                </div>
              ))}
            </div>

            <h3 className="text-[12px] font-bold text-damage mb-1.5 uppercase tracking-wider">
              Severity Multipliers (each 0.8–1.3)
            </h3>
            <ul className="text-[12.5px] text-text-secondary space-y-0.5 list-none p-0 m-0 mb-3">
              <li><strong>Durability</strong> — How lasting is the change?</li>
              <li><strong>Reversibility</strong> — Can it be undone by next administration?</li>
              <li><strong>Precedent</strong> — Does it create dangerous new norms?</li>
            </ul>

            <h3 className="text-[12px] font-bold text-damage mb-1.5 uppercase tracking-wider">
              Mechanism Modifiers
            </h3>
            <div className="space-y-0.5">
              {(Object.keys(MECHANISM_MODIFIERS) as Array<keyof typeof MECHANISM_MODIFIERS>).map((key) => (
                <div key={key} className="flex justify-between text-[12.5px]">
                  <span className="text-text-secondary">{MECHANISM_LABELS[key]}</span>
                  <span className="text-text-dim font-mono">×{MECHANISM_MODIFIERS[key]}</span>
                </div>
              ))}
            </div>
          </section>

          {/* List B */}
          <section className="bg-distraction/[0.03] border border-distraction/[0.08] rounded-lg p-3">
            <h2 className="text-sm font-bold text-distraction mb-1">List B — Distraction/Hype</h2>
            <p className="text-[12.5px] text-text-secondary leading-relaxed mb-3">
              Layer 1 measures raw hype (55% weight). Layer 2 measures strategic manipulation
              (45% weight, modulated by intentionality evidence 0–15).
            </p>
            <div className="font-mono text-[12px] text-distraction-light bg-distraction/[0.05] rounded p-2 mb-3">
              B = 100 × (0.55 × L1_avg/5 + intent_weight × L2_avg/5)
            </div>

            <h3 className="text-[12px] font-bold text-distraction mb-1 uppercase tracking-wider">
              Intentionality Thresholds
            </h3>
            <div className="text-[12.5px] text-text-secondary space-y-0.5 mb-3">
              <div>≥ 8/15 → Full strategic weight (<span className="font-mono">0.45</span>)</div>
              <div>4–7/15 → Reduced weight (<span className="font-mono">0.25</span>)</div>
              <div>&lt; 4/15 → Minimal weight (<span className="font-mono">0.10</span>)</div>
            </div>
          </section>

          {/* Classification */}
          <section className="bg-mixed/[0.03] border border-mixed/[0.08] rounded-lg p-3">
            <h2 className="text-sm font-bold text-mixed mb-1">Classification & Dominance Margin</h2>
            <p className="text-[12.5px] text-text-secondary leading-relaxed">
              Events are assigned to List A (damage), List B (distraction), or List C (noise)
              based on dominance margin (A − B). A ±10 threshold prevents bucket thrash.
              Events with both high A and high B scores receive a <strong>MIXED</strong> badge.
              List C catches low-salience events (A &lt; 25 AND B &lt; 25) and those
              failing the noise gate (A &lt; 25, no institutional mechanism).
            </p>
          </section>

          {/* Smokescreen */}
          <section className="bg-[#7C3AED06] border border-[#7C3AED18] rounded-lg p-3">
            <h2 className="text-sm font-bold text-mixed-light mb-1">Smokescreen Index</h2>
            <p className="text-[12.5px] text-text-secondary leading-relaxed mb-2">
              Pairs high-B distraction events with high-A damage events using temporal overlap
              and displacement evidence.
            </p>
            <div className="font-mono text-[12px] text-mixed-light bg-mixed/[0.05] rounded p-2">
              SI = (B × A / 100) × (0.7 + 0.3 × displacement_confidence)
            </div>
          </section>

          {/* Freeze policy */}
          <section className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3">
            <h2 className="text-sm font-bold text-text-muted mb-1">Weekly Freeze Policy</h2>
            <p className="text-[12.5px] text-text-secondary leading-relaxed">
              Weeks freeze Saturday 23:59 ET. Individual events freeze after 48h or at week-end,
              whichever comes first. Post-freeze corrections are append-only notices — original
              scores are the permanent record.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
