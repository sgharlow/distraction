import type { Metadata } from 'next';
import Link from 'next/link';
import { TopNav } from '@/components/TopNav';

export const metadata: Metadata = {
  title: 'About',
  description: 'The Distraction Index is an independent civic intelligence project tracking democratic damage vs. manufactured distractions during the Trump administration.',
  openGraph: {
    title: 'About The Distraction Index',
    description: 'An independent civic intelligence project tracking democratic damage vs. manufactured distractions.',
    url: '/about',
  },
  twitter: {
    card: 'summary',
    title: 'About | The Distraction Index',
    description: 'An independent civic intelligence project tracking democratic damage vs. manufactured distractions.',
  },
  alternates: {
    canonical: '/about',
  },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="mx-auto max-w-[720px] px-4 py-6">
        <h1 className="mb-1 font-serif text-xl font-extrabold text-text-primary">
          About The Distraction Index
        </h1>
        <p className="text-[13px] text-text-dim mb-5">
          Independent civic intelligence since December 2024
        </p>

        <section className="mb-6">
          <h2 className="text-base font-bold text-text-primary mb-2">Mission</h2>
          <p className="text-[14px] text-text-secondary leading-relaxed mb-3">
            The Distraction Index publishes a weekly, frozen record of U.S. political events
            scored on two dimensions: constitutional damage (A-score) and media hype /
            manufactured distraction (B-score). The goal is to help citizens distinguish
            between events that cause real democratic harm and events that are engineered
            to dominate attention.
          </p>
          <p className="text-[14px] text-text-secondary leading-relaxed">
            Every week runs Sunday through Saturday. Once a week closes, its scores freeze
            permanently. Post-freeze corrections are append-only and publicly documented on
            the{' '}
            <Link href="/corrections" className="text-mixed hover:underline">
              corrections page
            </Link>.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-bold text-text-primary mb-2">How It Works</h2>
          <p className="text-[14px] text-text-secondary leading-relaxed mb-3">
            Articles are ingested from multiple news sources every four hours. AI clustering
            groups articles into distinct events, which are then scored by AI using a
            transparent, versioned algorithm. Every scoring decision can be audited
            on the{' '}
            <Link href="/methodology" className="text-mixed hover:underline">
              methodology page
            </Link>.
          </p>
          <div className="bg-surface-raised border border-surface-border rounded-md p-3 mb-3">
            <div className="text-[12px] font-bold text-text-muted uppercase tracking-wider mb-2">
              Data Sources
            </div>
            <ul className="text-[13.5px] text-text-secondary space-y-1 m-0 pl-4">
              <li>GDELT Project (global event database, free and open)</li>
              <li>GNews API (aggregated news headlines)</li>
              <li>Google News RSS (supplemental coverage)</li>
            </ul>
          </div>
          <div className="bg-surface-raised border border-surface-border rounded-md p-3">
            <div className="text-[12px] font-bold text-text-muted uppercase tracking-wider mb-2">
              AI Models Used
            </div>
            <ul className="text-[13.5px] text-text-secondary space-y-1 m-0 pl-4">
              <li>Claude Haiku 4.5 &mdash; article clustering and event identification</li>
              <li>Claude Sonnet 4.5 &mdash; dual-axis scoring (A-score and B-score)</li>
            </ul>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-bold text-text-primary mb-2">Creator</h2>
          <p className="text-[14px] text-text-secondary leading-relaxed">
            The Distraction Index is an independent project by Steve Harlow, an AI and civic
            tech advocate. The source code is publicly available on{' '}
            <a
              href="https://github.com/sgharlow/distraction"
              target="_blank"
              rel="noopener noreferrer"
              className="text-mixed hover:underline"
            >
              GitHub
            </a>.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-bold text-text-primary mb-2">Principles</h2>
          <ul className="text-[14px] text-text-secondary space-y-2 m-0 pl-4">
            <li>
              <strong className="text-text-primary">Transparency:</strong> Every algorithm
              weight, modifier, and formula is documented publicly. No black boxes.
            </li>
            <li>
              <strong className="text-text-primary">Immutability:</strong> Frozen scores
              are never silently changed. Corrections are append-only and timestamped.
            </li>
            <li>
              <strong className="text-text-primary">Independence:</strong> No political
              affiliation, no advertising, no editorial influence. The algorithm scores
              events; humans review edge cases.
            </li>
            <li>
              <strong className="text-text-primary">Open Source:</strong> The full codebase
              is available for inspection, critique, and contribution.
            </li>
          </ul>
        </section>

        <div className="flex gap-2 flex-wrap">
          <Link
            href="/methodology"
            className="px-3 py-1.5 rounded border border-surface-border bg-white/[0.04] text-[12.5px] font-semibold text-text-muted hover:text-mixed hover:border-mixed/25 transition-colors no-underline"
          >
            Read the Methodology
          </Link>
          <Link
            href="/contact"
            className="px-3 py-1.5 rounded border border-surface-border bg-white/[0.04] text-[12.5px] font-semibold text-text-muted hover:text-mixed hover:border-mixed/25 transition-colors no-underline"
          >
            Get in Touch
          </Link>
          <a
            href="https://github.com/sgharlow/distraction"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded border border-surface-border bg-white/[0.04] text-[12.5px] font-semibold text-text-muted hover:text-mixed hover:border-mixed/25 transition-colors no-underline"
          >
            View Source on GitHub
          </a>
        </div>
      </main>
    </div>
  );
}
