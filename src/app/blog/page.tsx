import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllBlogPosts } from '@/lib/data/blog';
import { getWeekNumber } from '@/lib/weeks';
import { TopNav } from '@/components/TopNav';
import { NewsletterSignup } from '@/components/NewsletterSignup';

export const metadata: Metadata = {
  title: 'Blog — Weekly Analysis',
  description: 'Weekly analysis of democratic damage vs. manufactured distractions, powered by data from The Distraction Index.',
  alternates: {
    canonical: '/blog',
  },
  openGraph: {
    title: 'Blog — The Distraction Index',
    description: 'Weekly civic intelligence analysis backed by data.',
  },
};

export default async function BlogPage() {
  const posts = await getAllBlogPosts();

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="max-w-[900px] mx-auto px-5 py-6">
        <h1 className="font-serif text-xl font-bold text-text-primary mb-1">Weekly Analysis</h1>
        <p className="text-[13px] text-text-secondary mb-6">
          Data-driven analysis of democratic damage vs. manufactured distractions, published every week.
        </p>

        <div className="space-y-0">
          {posts.map((post) => (
            <article key={post.id} className="border-b border-surface-border-light py-4">
              <Link href={`/blog/${post.slug}`} className="no-underline group">
                <h2 className="font-serif text-base font-bold text-text-primary group-hover:text-damage transition-colors">
                  {post.title}
                </h2>
                {post.meta_description && (
                  <p className="text-[13px] text-text-secondary mt-1 leading-[1.4]">
                    {post.meta_description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1.5 font-sans text-[9px] text-text-muted">
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
            <p className="text-text-muted text-[13px]">No posts yet. Check back soon.</p>
          )}
        </div>

        <NewsletterSignup />
      </main>
    </div>
  );
}
