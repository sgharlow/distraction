import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://distractionindex.org'),
  title: {
    default: 'The Distraction Index',
    template: '%s | The Distraction Index',
  },
  description:
    'Weekly civic intelligence report tracking democratic damage vs. manufactured distractions. See through the noise.',
  openGraph: {
    title: {
      default: 'The Distraction Index',
      template: '%s | The Distraction Index',
    },
    description:
      'Weekly civic intelligence report tracking democratic damage vs. manufactured distractions. See through the noise.',
    url: 'https://distractionindex.org',
    siteName: 'The Distraction Index',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: {
      default: 'The Distraction Index',
      template: '%s | The Distraction Index',
    },
    description:
      'Weekly civic intelligence report tracking democratic damage vs. manufactured distractions. See through the noise.',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://distractionindex.org',
    types: {
      'application/atom+xml': '/feed.xml',
    },
  },
  verification: {
    google: 'dzOvcZvrc0WdbHUBcUGh9ZwGZzxJrnIGk8RsFzov3F8',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'The Distraction Index',
              url: 'https://distractionindex.org',
              description:
                'Weekly civic intelligence report tracking democratic damage vs. manufactured distractions.',
              publisher: {
                '@type': 'Organization',
                name: 'The Distraction Index',
                url: 'https://distractionindex.org',
              },
              potentialAction: {
                '@type': 'SearchAction',
                target: 'https://distractionindex.org/search?q={search_term_string}',
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
      </head>
      <body className="min-h-screen bg-surface-base text-text-primary antialiased font-serif">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
