import type { Metadata } from 'next';
import Link from 'next/link';
import { TopNav } from '@/components/TopNav';

export const metadata: Metadata = {
  title: 'Support',
  description: 'Support The Distraction Index — an independent, ad-free civic intelligence project.',
  openGraph: {
    title: 'Support The Distraction Index',
    description: 'Help keep this independent civic intelligence project free, open-source, and ad-free.',
    url: '/support',
  },
  twitter: {
    card: 'summary',
    title: 'Support | The Distraction Index',
    description: 'Help keep this independent civic intelligence project free, open-source, and ad-free.',
  },
  alternates: {
    canonical: '/support',
  },
};

export default function SupportPage() {
  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="mx-auto max-w-[720px] px-4 py-6">
        <h1 className="mb-1 font-serif text-xl font-extrabold text-text-primary">
          Support The Distraction Index
        </h1>
        <p className="text-[13px] text-text-dim mb-5">
          Independent. Ad-free. Open source.
        </p>

        <section className="mb-6">
          <h2 className="text-base font-bold text-text-primary mb-2">Why Support?</h2>
          <p className="text-[14px] text-text-secondary leading-relaxed mb-3">
            The Distraction Index is a free, open-source civic intelligence project
            with no advertising, no paywalls, and no editorial influence. Running it
            costs real money — AI scoring, hosting, and news data APIs all have
            monthly costs.
          </p>
          <p className="text-[14px] text-text-secondary leading-relaxed">
            Your donation helps keep the project independent and sustainable. Every
            contribution, no matter the size, directly supports the infrastructure
            that powers weekly analysis.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-bold text-text-primary mb-2">What Your Support Covers</h2>
          <div className="bg-surface-raised border border-surface-border rounded-md p-3">
            <ul className="text-[13.5px] text-text-secondary space-y-1.5 m-0 pl-4">
              <li><strong className="text-text-primary">AI Scoring</strong> — Claude API costs for clustering and dual-axis scoring</li>
              <li><strong className="text-text-primary">Hosting</strong> — Vercel serverless infrastructure and database</li>
              <li><strong className="text-text-primary">Data Sources</strong> — News API subscriptions for comprehensive coverage</li>
              <li><strong className="text-text-primary">Development</strong> — Ongoing improvements to scoring algorithms and features</li>
            </ul>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-bold text-text-primary mb-2">Donate</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-surface-raised border border-surface-border rounded-md p-4 text-center">
              <div className="text-[12px] font-bold text-text-muted uppercase tracking-wider mb-2">
                Ko-fi
              </div>
              <p className="text-[13px] text-text-secondary mb-3 m-0">
                One-time or recurring. No account required — pay with any card.
              </p>
              <a
                href="https://ko-fi.com/distractionindex"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-mixed/20 border border-mixed/30 text-mixed text-[13px] font-bold tracking-wider px-5 py-1.5 rounded hover:bg-mixed/30 transition-colors no-underline"
              >
                DONATE ON KO-FI
              </a>
            </div>
            <div className="bg-surface-raised border border-surface-border rounded-md p-4 text-center">
              <div className="text-[12px] font-bold text-text-muted uppercase tracking-wider mb-2">
                GitHub Sponsors
              </div>
              <p className="text-[13px] text-text-secondary mb-3 m-0">
                One-time or monthly. Requires a GitHub account. Zero platform fees.
              </p>
              <a
                href="https://github.com/sponsors/sgharlow"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-mixed/20 border border-mixed/30 text-mixed text-[13px] font-bold tracking-wider px-5 py-1.5 rounded hover:bg-mixed/30 transition-colors no-underline"
              >
                SPONSOR ON GITHUB
              </a>
            </div>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-bold text-text-primary mb-2">Other Ways to Help</h2>
          <ul className="text-[14px] text-text-secondary space-y-2 m-0 pl-4">
            <li>
              <strong className="text-text-primary">Share it:</strong> Tell others about
              The Distraction Index. The more people tracking democratic accountability,
              the better.
            </li>
            <li>
              <strong className="text-text-primary">Contribute code:</strong> The project is{' '}
              <a
                href="https://github.com/sgharlow/distraction"
                target="_blank"
                rel="noopener noreferrer"
                className="text-mixed hover:underline"
              >
                open source on GitHub
              </a>. Bug reports, feature suggestions, and pull requests are welcome.
            </li>
            <li>
              <strong className="text-text-primary">Report corrections:</strong> If you spot
              a scoring error, submit it on the{' '}
              <Link href="/corrections" className="text-mixed hover:underline">
                corrections page
              </Link>.
            </li>
          </ul>
        </section>

        <div className="flex gap-2 flex-wrap">
          <Link
            href="/week/current"
            className="px-3 py-1.5 rounded border border-surface-border bg-white/[0.04] text-[12.5px] font-semibold text-text-muted hover:text-mixed hover:border-mixed/25 transition-colors no-underline"
          >
            Back to Dashboard
          </Link>
          <Link
            href="/about"
            className="px-3 py-1.5 rounded border border-surface-border bg-white/[0.04] text-[12.5px] font-semibold text-text-muted hover:text-mixed hover:border-mixed/25 transition-colors no-underline"
          >
            About the Project
          </Link>
        </div>
      </main>
    </div>
  );
}
