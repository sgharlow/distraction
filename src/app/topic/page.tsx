import type { Metadata } from 'next';
import Link from 'next/link';
import { TopNav } from '@/components/TopNav';
import { getAllTopics } from '@/lib/data/topics';

export const metadata: Metadata = {
  title: 'Topics',
  description: 'Browse all topic tags across all scored events in The Distraction Index.',
  openGraph: {
    title: 'Topics',
    description: 'Browse all topic tags across all scored events in The Distraction Index.',
    url: '/topic',
  },
  twitter: {
    card: 'summary',
    title: 'Topics | The Distraction Index',
    description: 'Browse all topic tags across all scored events.',
  },
  alternates: {
    canonical: '/topic',
  },
};

export default async function TopicsPage() {
  const topics = await getAllTopics();

  const maxCount = topics.length > 0 ? topics[0].count : 1;

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="max-w-[860px] mx-auto px-4 py-6">
        <h1 className="text-lg font-extrabold text-text-primary font-serif mb-1">
          Topics
        </h1>
        <p className="text-[11px] text-text-muted mb-4">
          {topics.length} topic tag{topics.length !== 1 ? 's' : ''} across all weeks. Click to explore.
        </p>

        {topics.length === 0 ? (
          <p className="text-text-dim text-xs">No topics found.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {topics.map(({ tag, count }) => {
              const intensity = Math.max(0.3, count / maxCount);
              return (
                <Link
                  key={tag}
                  href={`/topic/${encodeURIComponent(tag)}`}
                  className="no-underline hover:scale-105 transition-transform"
                  style={{ opacity: 0.4 + intensity * 0.6 }}
                >
                  <span
                    className="inline-block px-2 py-1 rounded-md bg-mixed/10 border border-mixed/15 text-mixed font-mono hover:bg-mixed/20 transition-colors"
                    style={{
                      fontSize: `${Math.max(10, Math.min(16, 10 + (count / maxCount) * 6))}px`,
                    }}
                  >
                    #{tag}
                    <span className="text-text-dim ml-1" style={{ fontSize: '9px' }}>
                      {count}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
