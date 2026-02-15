import type { Metadata } from 'next';
import Link from 'next/link';
import { TopNav } from '@/components/TopNav';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy policy for The Distraction Index. How we handle your data.',
  openGraph: {
    title: 'Privacy Policy',
    description: 'Privacy policy for The Distraction Index.',
    url: '/privacy',
  },
  alternates: {
    canonical: '/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="mx-auto max-w-[720px] px-4 py-6">
        <h1 className="mb-1 font-serif text-xl font-extrabold text-text-primary">
          Privacy Policy
        </h1>
        <p className="text-[13px] text-text-dim mb-5">
          Last updated: February 2026
        </p>

        <div className="space-y-5 text-[14px] text-text-secondary leading-relaxed">
          <section>
            <h2 className="text-base font-bold text-text-primary mb-2">Overview</h2>
            <p>
              The Distraction Index is committed to protecting your privacy. This policy
              explains what data we collect, how we use it, and your rights regarding
              that data.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-text-primary mb-2">Data We Collect</h2>

            <h3 className="text-[14px] font-bold text-text-primary mt-3 mb-1">Email Addresses</h3>
            <p>
              If you subscribe to our mailing list, we store your email address in our
              database. We use this solely to send you updates about The Distraction Index.
              We do not sell, share, or provide your email address to any third party.
            </p>

            <h3 className="text-[14px] font-bold text-text-primary mt-3 mb-1">Contact Form Submissions</h3>
            <p>
              If you submit a message through our contact form, we store your name, email
              address, and message content to respond to your inquiry. This data is not
              shared with third parties.
            </p>

            <h3 className="text-[14px] font-bold text-text-primary mt-3 mb-1">Analytics</h3>
            <p>
              We use Vercel Analytics to understand how visitors use the site. This collects
              anonymized, aggregated data such as page views and visit duration. It does not
              use cookies and does not track individual users across sites.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-text-primary mb-2">Data We Do Not Collect</h2>
            <ul className="pl-4 space-y-1 m-0">
              <li>We do not use advertising trackers or third-party cookies.</li>
              <li>We do not collect personal data beyond what you voluntarily provide.</li>
              <li>We do not sell any data to third parties.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-text-primary mb-2">Data Storage</h2>
            <p>
              Data is stored on Supabase (PostgreSQL) infrastructure hosted in the United
              States. The site is served through Vercel&apos;s global CDN.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-text-primary mb-2">Your Rights</h2>
            <p>
              You may request deletion of your data at any time by contacting us through
              the{' '}
              <Link href="/contact" className="text-mixed hover:underline">
                contact page
              </Link>. We will remove your information within 30 days of your request.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-text-primary mb-2">Open Source</h2>
            <p>
              The complete source code for this site, including data handling logic, is
              publicly available on{' '}
              <a
                href="https://github.com/sgharlow/distraction"
                target="_blank"
                rel="noopener noreferrer"
                className="text-mixed hover:underline"
              >
                GitHub
              </a>. You can verify exactly how your data is processed.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-text-primary mb-2">Changes</h2>
            <p>
              If this policy changes, we will update the &ldquo;Last updated&rdquo; date above.
              Continued use of the site after changes constitutes acceptance of the
              updated policy.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
