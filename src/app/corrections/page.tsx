import type { Metadata } from 'next';
import { TopNav } from '@/components/TopNav';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Corrections',
  description: 'Post-freeze corrections across all weekly editions of The Distraction Index.',
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
      <main className="mx-auto max-w-[820px] px-4 py-6">
        <h1 className="mb-1 font-serif text-xl font-extrabold text-text-primary">Corrections</h1>
        <p className="mb-5 text-[11.5px] text-text-muted">
          Post-freeze corrections across all weekly editions. Original scores are always preserved.
        </p>

        {items.length === 0 ? (
          <p className="text-sm text-text-dim">No corrections have been issued.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-distraction/[0.03] border border-distraction/[0.08] rounded-md p-3"
              >
                <div className="text-xs font-bold text-text-primary">{item.title}</div>
                <div className="text-[9.5px] text-text-dim mt-0.5">
                  Week: {item.week_id} · List {item.primary_list} · A:{item.a_score?.toFixed(1)} B:{item.b_score?.toFixed(1)}
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed mt-1 m-0">
                  {item.correction_notice}
                </p>
                {item.correction_at && (
                  <div className="text-[9px] text-text-dim mt-1">
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
