import type { Metadata } from 'next';
import Link from 'next/link';
import { TopNav } from '@/components/TopNav';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Corrections',
  description: 'Post-freeze corrections across all weekly editions of The Distraction Index. Original scores are always preserved.',
  openGraph: {
    title: 'Corrections',
    description: 'Post-freeze corrections across all weekly editions. Original scores are always preserved.',
    url: '/corrections',
  },
  twitter: {
    card: 'summary',
    title: 'Corrections | The Distraction Index',
    description: 'Post-freeze corrections across all weekly editions. Original scores are always preserved.',
  },
  alternates: {
    canonical: '/corrections',
  },
};

export default async function CorrectionsPage() {
  const supabase = await createClient();
  const { data: corrections } = await supabase
    .from('events')
    .select('id, title, week_id, correction_notice, correction_at, a_score, b_score, primary_list')
    .not('correction_notice', 'is', null)
    .order('correction_at', { ascending: false })
    .limit(50);

  const items = corrections ?? [];

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="mx-auto max-w-[900px] px-5 py-6">
        <h1 className="mb-1 font-serif text-xl font-bold text-text-primary">Corrections</h1>
        <p className="font-sans text-[9px] text-text-dim tracking-[0.5px] uppercase mb-5">
          Post-freeze corrections · Original scores always preserved
        </p>

        {items.length === 0 ? (
          <div className="bg-surface-overlay border border-surface-border rounded-[6px] p-5 text-center">
            <div className="font-sans text-[9px] font-semibold uppercase tracking-[2px] text-text-dim mb-1.5">
              No Corrections
            </div>
            <p className="text-[13px] text-text-secondary leading-relaxed m-0 mb-2">
              Corrections appear here when frozen weekly editions require
              factual corrections. Once a week is frozen, scores are immutable —
              but factual errors can be noted as append-only corrections.
            </p>
            <Link
              href="/week/current"
              className="font-sans text-[11px] text-text-primary underline hover:text-damage no-underline"
            >
              Back to Dashboard
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-distraction-light border border-surface-border rounded-[6px] p-3"
              >
                <div className="font-serif text-sm font-bold text-text-primary">{item.title}</div>
                <div className="font-sans text-[9px] text-text-dim mt-0.5">
                  Week: {item.week_id} · List {item.primary_list} · A:{item.a_score?.toFixed(1)} B:{item.b_score?.toFixed(1)}
                </div>
                <p className="text-[13px] text-text-secondary leading-relaxed mt-1 m-0">
                  {item.correction_notice}
                </p>
                {item.correction_at && (
                  <div className="font-sans text-[9px] text-text-dim mt-1">
                    Issued: {new Date(item.correction_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
