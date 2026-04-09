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
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'The Distraction Index',
    url: 'https://distractionindex.org',
    description: 'Independent civic intelligence platform tracking democratic damage vs. manufactured distractions.',
    foundingDate: '2024-12-29',
    founder: { '@type': 'Person', name: 'Steve Harlow' },
    sameAs: [
      'https://bsky.app/profile/sgharlow.bsky.social',
      'https://mastodon.social/@sgharlow',
      'https://www.threads.net/@distractionindex',
      'https://distractionindex.substack.com',
      'https://github.com/sgharlow/distraction',
    ],
  };

  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <TopNav />
      <main className="mx-auto max-w-[900px] px-5 py-6">
        <h1 className="mb-1 font-serif text-xl font-bold text-text-primary">
          About The Distraction Index
        </h1>
        <p className="font-sans text-[9px] text-text-dim tracking-[0.5px] uppercase mb-5">
          Independent civic intelligence since December 2024
        </p>

        <section className="mb-6">
          <h2 className="font-serif text-base font-bold text-text-primary mb-2">Mission</h2>
          <p className="text-[13px] text-text-secondary leading-relaxed mb-3">
            The Distraction Index publishes a weekly, frozen record of U.S. political events
            scored on two dimensions: constitutional damage (Damage score) and media hype /
            manufactured distraction (Hype score). The goal is to help citizens distinguish
            between events that cause real democratic harm and events that are engineered
            to dominate attention.
          </p>
          <p className="text-[13px] text-text-secondary leading-relaxed">
            Every week runs Sunday through Saturday. Once a week closes, its scores freeze
            permanently. Post-freeze corrections are append-only and publicly documented on
            the{' '}
            <Link href="/corrections" className="text-text-primary underline hover:text-damage">
              corrections page
            </Link>.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="font-serif text-base font-bold text-text-primary mb-2">How It Works</h2>
          <p className="text-[13px] text-text-secondary leading-relaxed mb-3">
            Articles are ingested from multiple news sources every four hours. AI clustering
            groups articles into distinct events, which are then scored by AI using a
            transparent, versioned algorithm. Every scoring decision can be audited
            on the{' '}
            <Link href="/methodology" className="text-text-primary underline hover:text-damage">
              methodology page
            </Link>.
          </p>
          <div className="bg-surface-overlay border border-surface-border rounded-[6px] p-3 mb-3">
            <div className="font-sans text-[9px] font-semibold text-text-dim uppercase tracking-[2px] mb-2">
              Data Sources
            </div>
            <ul className="text-[13px] text-text-secondary space-y-1 m-0 pl-4">
              <li>GDELT Project (global event database, free and open)</li>
              <li>GNews API (aggregated news headlines)</li>
              <li>Google News RSS (supplemental coverage)</li>
            </ul>
          </div>
          <div className="bg-surface-overlay border border-surface-border rounded-[6px] p-3">
            <div className="font-sans text-[9px] font-semibold text-text-dim uppercase tracking-[2px] mb-2">
              AI Models Used
            </div>
            <ul className="text-[13px] text-text-secondary space-y-1 m-0 pl-4">
              <li>Claude Haiku 4.5 &mdash; article clustering and event identification</li>
              <li>Claude Sonnet 4.5 &mdash; dual-axis scoring (Damage and Hype)</li>
            </ul>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="font-serif text-base font-bold text-text-primary mb-2">Creator</h2>
          <p className="text-[13px] text-text-secondary leading-relaxed">
            The Distraction Index is an independent project by Steve Harlow, an AI and civic
            tech advocate. The source code is publicly available on{' '}
            <a
              href="https://github.com/sgharlow/distraction"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-primary underline hover:text-damage"
            >
              GitHub
            </a>.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="font-serif text-base font-bold text-text-primary mb-2">Principles</h2>
          <ul className="text-[13px] text-text-secondary space-y-2 m-0 pl-4">
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

        <section className="mb-6">
          <h2 className="font-serif text-base font-bold text-text-primary mb-2">Support This Project</h2>
          <p className="text-[13px] text-text-secondary leading-relaxed mb-3">
            The Distraction Index is free, ad-free, and open source. If you find it useful,
            consider{' '}
            <Link href="/support" className="text-text-primary underline hover:text-damage">
              making a donation
            </Link>{' '}
            to help cover AI scoring, hosting, and data costs.
          </p>
        </section>

        <div className="flex gap-2 flex-wrap">
          <Link
            href="/methodology"
            className="font-sans border border-surface-border text-[11px] font-semibold text-text-dim px-3 py-1.5 rounded-[3px] hover:text-text-primary hover:border-text-dim transition-colors no-underline"
          >
            Read the Methodology
          </Link>
          <Link
            href="/contact"
            className="font-sans border border-surface-border text-[11px] font-semibold text-text-dim px-3 py-1.5 rounded-[3px] hover:text-text-primary hover:border-text-dim transition-colors no-underline"
          >
            Get in Touch
          </Link>
          <a
            href="https://github.com/sgharlow/distraction"
            target="_blank"
            rel="noopener noreferrer"
            className="font-sans border border-surface-border text-[11px] font-semibold text-text-dim px-3 py-1.5 rounded-[3px] hover:text-text-primary hover:border-text-dim transition-colors no-underline"
          >
            View Source on GitHub
          </a>
        </div>
      </main>
    </div>
  );
}
