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
  alternates: {
    canonical: '/contact',
  },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="mx-auto max-w-[600px] px-4 py-6">
        <h1 className="mb-1 font-serif text-xl font-extrabold text-text-primary">
          Contact
        </h1>
        <p className="text-[13.5px] text-text-secondary mb-5 leading-relaxed">
          Have a question, correction, or feedback? Send us a message below,
          or open an issue on{' '}
          <a
            href="https://github.com/sgharlow/distraction"
            target="_blank"
            rel="noopener noreferrer"
            className="text-mixed hover:underline"
          >
            GitHub
          </a>.
        </p>

        <ContactForm />
      </main>
    </div>
  );
}
