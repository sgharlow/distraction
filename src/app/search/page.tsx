import type { Metadata } from 'next';
import Link from 'next/link';
import { TopNav } from '@/components/TopNav';
import { DualScore } from '@/components/DualScore';
import { MechanismBadge } from '@/components/MechanismBadge';
import { searchEvents } from '@/lib/data/events';

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const sp = await searchParams;
  const q = sp.q?.trim();
  const title = q ? `"${q}" — Search` : 'Search';
  const description = q
    ? `Search results for "${q}" across all scored events in The Distraction Index.`
    : 'Search all scored events across all weeks of The Distraction Index.';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: '/search',
    },
    twitter: {
      card: 'summary',
      title: `${title} | The Distraction Index`,
      description,
    },
    robots: {
      index: !q,
      follow: true,
    },
    alternates: {
      canonical: '/search',
    },
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? '';
  const results = q.length > 0 ? await searchEvents(q, 50) : [];

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="max-w-[860px] mx-auto px-4 py-6">
        <h1 className="text-lg font-extrabold text-text-primary font-serif mb-3">
          Search Events
        </h1>

        {/* Search form */}
        <form action="/search" method="GET" className="mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search events, topics, summaries..."
              className="flex-1 bg-surface-raised border border-surface-border rounded-md px-3 py-2 text-[13px] text-text-primary placeholder:text-text-dim/50 focus:outline-none focus:border-mixed/40 transition-colors"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-mixed/10 border border-mixed/20 rounded-md text-[12px] font-semibold text-mixed hover:bg-mixed/20 transition-colors"
            >
              Search
            </button>
          </div>
        </form>

        {/* Results */}
        {q.length > 0 && (
          <p className="text-[11px] text-text-muted mb-3">
            {results.length} result{results.length !== 1 ? 's' : ''} for &ldquo;{q}&rdquo;
          </p>
        )}

        {q.length > 0 && results.length === 0 && (
          <p className="text-text-dim text-xs">No events found matching your query.</p>
        )}

        {results.length > 0 && (
          <div className="space-y-1.5">
            {results.map((event) => {
              const color = event.primary_list === 'A' ? 'damage' : event.primary_list === 'B' ? 'distraction' : 'noise';
              return (
                <Link
                  key={event.id}
                  href={`/event/${event.id}`}
                  className={`block bg-${color}/[0.02] border border-${color}/[0.06] rounded-md p-2.5 no-underline hover:border-${color}/15 transition-colors`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[8px] font-bold tracking-widest text-${color}`}>
                          {event.primary_list === 'A' ? 'DMG' : event.primary_list === 'B' ? 'DIST' : 'NOISE'}
                        </span>
                        <span className="text-[9px] text-text-dim">
                          {event.event_date}
                        </span>
                        <span className="text-[9px] text-text-dim">
                          Week: {event.week_id}
                        </span>
                      </div>
                      <div className="text-[12px] text-text-primary font-semibold leading-tight">
                        {event.title}
                      </div>
                      <MechanismBadge
                        mechanism={event.mechanism_of_harm}
                        scope={event.scope}
                        affectedPopulation={event.affected_population}
                      />
                      {event.summary && (
                        <p className="text-[10.5px] text-text-muted mt-1 m-0 line-clamp-2 leading-relaxed">
                          {event.summary}
                        </p>
                      )}
                    </div>
                    <div className="text-right min-w-[80px] shrink-0">
                      <DualScore aScore={event.a_score} bScore={event.b_score} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {q.length === 0 && (
          <div className="text-center py-12">
            <div className="text-3xl mb-2">🔍</div>
            <p className="text-[13px] text-text-dim">
              Search across all {'>'}1,500 scored events by keyword, topic, or phrase.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
