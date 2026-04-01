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
      <main className="mx-auto max-w-[900px] px-5 py-6">
        <h1 className="mb-1 font-serif text-xl font-bold text-text-primary">
          Support The Distraction Index
        </h1>
        <p className="font-sans text-[9px] text-text-dim tracking-[0.5px] uppercase mb-5">
          Independent · Ad-free · Open source
        </p>

        <section className="mb-6">
          <h2 className="font-serif text-base font-bold text-text-primary mb-2">Why Support?</h2>
          <p className="text-[13px] text-text-secondary leading-relaxed mb-3">
            The Distraction Index is a free, open-source civic intelligence project
            with no advertising, no paywalls, and no editorial influence. Running it
            costs real money — AI scoring, hosting, and news data APIs all have
            monthly costs.
          </p>
          <p className="text-[13px] text-text-secondary leading-relaxed">
            Your donation helps keep the project independent and sustainable. Every
            contribution, no matter the size, directly supports the infrastructure
            that powers weekly analysis.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="font-serif text-base font-bold text-text-primary mb-2">What Your Support Covers</h2>
          <div className="bg-surface-overlay border border-surface-border rounded-[6px] p-3">
            <ul className="text-[13px] text-text-secondary space-y-1.5 m-0 pl-4">
              <li><strong className="text-text-primary">AI Scoring</strong> — Claude API costs for clustering and dual-axis scoring</li>
              <li><strong className="text-text-primary">Hosting</strong> — Vercel serverless infrastructure and database</li>
              <li><strong className="text-text-primary">Data Sources</strong> — News API subscriptions for comprehensive coverage</li>
              <li><strong className="text-text-primary">Development</strong> — Ongoing improvements to scoring algorithms and features</li>
            </ul>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="font-serif text-base font-bold text-text-primary mb-2">Donate</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-surface-overlay border border-surface-border rounded-[6px] p-4 text-center">
              <div className="font-sans text-[9px] font-semibold text-text-dim uppercase tracking-[2px] mb-2">
                Ko-fi
              </div>
              <p className="text-[13px] text-text-secondary mb-3 m-0">
                One-time or recurring. No account required — pay with any card.
              </p>
              <a
                href="https://ko-fi.com/distractionindex"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block font-sans bg-text-primary text-surface-base text-[11px] font-semibold px-5 py-1.5 rounded-[3px] hover:opacity-85 transition-opacity no-underline"
              >
                DONATE ON KO-FI
              </a>
            </div>
            <div className="bg-surface-overlay border border-surface-border rounded-[6px] p-4 text-center">
              <div className="font-sans text-[9px] font-semibold text-text-dim uppercase tracking-[2px] mb-2">
                GitHub Sponsors
              </div>
              <p className="text-[13px] text-text-secondary mb-3 m-0">
                One-time or monthly. Requires a GitHub account. Zero platform fees.
              </p>
              <a
                href="https://github.com/sponsors/sgharlow"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block font-sans bg-text-primary text-surface-base text-[11px] font-semibold px-5 py-1.5 rounded-[3px] hover:opacity-85 transition-opacity no-underline"
              >
                SPONSOR ON GITHUB
              </a>
            </div>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="font-serif text-base font-bold text-text-primary mb-2">Other Ways to Help</h2>
          <ul className="text-[13px] text-text-secondary space-y-2 m-0 pl-4">
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
                className="text-text-primary underline hover:text-damage"
              >
                open source on GitHub
              </a>. Bug reports, feature suggestions, and pull requests are welcome.
            </li>
            <li>
              <strong className="text-text-primary">Report corrections:</strong> If you spot
              a scoring error, submit it on the{' '}
              <Link href="/corrections" className="text-text-primary underline hover:text-damage">
                corrections page
              </Link>.
            </li>
          </ul>
        </section>

        <div className="flex gap-2 flex-wrap">
          <Link
            href="/week/current"
            className="font-sans border border-surface-border text-[11px] font-semibold text-text-dim px-3 py-1.5 rounded-[3px] hover:text-text-primary hover:border-text-dim transition-colors no-underline"
          >
            Back to Dashboard
          </Link>
          <Link
            href="/about"
            className="font-sans border border-surface-border text-[11px] font-semibold text-text-dim px-3 py-1.5 rounded-[3px] hover:text-text-primary hover:border-text-dim transition-colors no-underline"
          >
            About the Project
          </Link>
        </div>
      </main>
    </div>
  );
}
