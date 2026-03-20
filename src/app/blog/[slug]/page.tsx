import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getBlogPost, getAllBlogPosts } from '@/lib/data/blog';
import { getWeekNumber } from '@/lib/weeks';
import { NewsletterSignup } from '@/components/NewsletterSignup';

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return { title: 'Post Not Found' };

  return {
    title: post.title,
    description: post.meta_description ?? post.body_markdown.slice(0, 160),
    keywords: post.keywords,
    openGraph: {
      title: post.title,
      description: post.meta_description ?? undefined,
      type: 'article',
      publishedTime: post.published_at,
      modifiedTime: post.updated_at,
      url: `/blog/${post.slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.meta_description ?? undefined,
    },
  };
}

export const dynamic = 'force-dynamic';

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();

  const weekNum = post.week_id ? getWeekNumber(new Date(post.week_id)) : null;
  const html = markdownToHtml(post.body_markdown);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.meta_description,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    author: { '@type': 'Person', name: 'Steve Harlow' },
    publisher: {
      '@type': 'Organization',
      name: 'The Distraction Index',
      url: 'https://distractionindex.org',
    },
    mainEntityOfPage: `https://distractionindex.org/blog/${post.slug}`,
    keywords: post.keywords?.join(', '),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/blog" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-action)]">
          &larr; Back to blog
        </Link>

        <article className="mt-6">
          <h1 className="text-3xl font-bold mb-3">{post.title}</h1>

          <div className="flex items-center gap-3 mb-8 text-sm text-[var(--color-text-muted)]">
            <time dateTime={post.published_at}>
              {new Date(post.published_at).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            </time>
            {weekNum && (
              <Link href={`/week/${post.week_id}`} className="hover:text-[var(--color-action)]">
                Week {weekNum} Report &rarr;
              </Link>
            )}
          </div>

          <div
            className="prose prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          {post.week_id && (
            <div className="mt-8 p-4 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-border)]">
              <p className="font-semibold mb-2">See the full interactive report</p>
              <Link
                href={`/week/${post.week_id}`}
                className="text-[var(--color-action)] hover:underline"
              >
                Week {weekNum}: Full scores, smokescreen pairs, and source citations &rarr;
              </Link>
            </div>
          )}
        </article>

        <NewsletterSignup />
      </main>
    </>
  );
}

/** Minimal markdown to HTML converter for blog posts */
function markdownToHtml(md: string): string {
  return md
    .split('\n\n')
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('## ')) return `<h2>${trimmed.slice(3)}</h2>`;
      if (trimmed.startsWith('### ')) return `<h3>${trimmed.slice(4)}</h3>`;
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const items = trimmed.split('\n').map((l) => `<li>${inlineFormat(l.replace(/^[-*]\s*/, ''))}</li>`).join('');
        return `<ul>${items}</ul>`;
      }
      return `<p>${inlineFormat(trimmed)}</p>`;
    })
    .join('\n');
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-[var(--color-action)] hover:underline">$1</a>');
}
