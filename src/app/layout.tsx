import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

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
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-surface-base text-text-primary antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
