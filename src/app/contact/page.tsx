import type { Metadata } from 'next';
import { TopNav } from '@/components/TopNav';
import { ContactForm } from '@/components/ContactForm';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with The Distraction Index team.',
  openGraph: {
    title: 'Contact',
    description: 'Get in touch with The Distraction Index team.',
    url: '/contact',
  },
  twitter: {
    card: 'summary',
    title: 'Contact | The Distraction Index',
    description: 'Get in touch with The Distraction Index team.',
  },
  alternates: {
    canonical: '/contact',
  },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="mx-auto max-w-[900px] px-5 py-6">
        <h1 className="mb-1 font-serif text-xl font-bold text-text-primary">
          Contact
        </h1>
        <p className="text-[13px] text-text-secondary mb-5 leading-relaxed">
          Have a question, correction, or feedback? Send us a message below,
          or open an issue on{' '}
          <a
            href="https://github.com/sgharlow/distraction"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-primary underline hover:text-damage"
          >
            GitHub
          </a>.
        </p>

        <ContactForm />
      </main>
    </div>
  );
}
