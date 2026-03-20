import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllBlogPosts } from '@/lib/data/blog';
import { getWeekNumber } from '@/lib/weeks';
import { NewsletterSignup } from '@/components/NewsletterSignup';

export const metadata: Metadata = {
  title: 'Blog — Weekly Analysis',
  description: 'Weekly analysis of democratic damage vs. manufactured distractions, powered by data from The Distraction Index.',
  openGraph: {
    title: 'Blog — The Distraction Index',
    description: 'Weekly civic intelligence analysis backed by data.',
  },
};

export default async function BlogPage() {
  const posts = await getAllBlogPosts();

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Weekly Analysis</h1>
      <p className="text-[var(--color-text-secondary)] mb-8">
        Data-driven analysis of democratic damage vs. manufactured distractions, published every week.
      </p>

      <div className="space-y-8">
        {posts.map((post) => (
          <article key={post.id} className="border-b border-[var(--color-border)] pb-6">
            <Link href={`/blog/${post.slug}`} className="group">
              <h2 className="text-xl font-semibold group-hover:text-[var(--color-action)] transition-colors">
                {post.title}
              </h2>
              {post.meta_description && (
                <p className="text-[var(--color-text-secondary)] mt-1">
                  {post.meta_description}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2 text-sm text-[var(--color-text-muted)]">
                <time dateTime={post.published_at}>
                  {new Date(post.published_at).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric',
                  })}
                </time>
                {post.week_id && (
                  <span>Week {getWeekNumber(new Date(post.week_id))}</span>
                )}
                {post.word_count && (
                  <span>{Math.ceil(post.word_count / 200)} min read</span>
                )}
              </div>
            </Link>
          </article>
        ))}

        {posts.length === 0 && (
          <p className="text-[var(--color-text-muted)]">No posts yet. Check back soon.</p>
        )}
      </div>

      <NewsletterSignup />
    </main>
  );
}
