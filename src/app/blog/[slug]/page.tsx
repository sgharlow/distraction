import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import sanitizeHtml from 'sanitize-html';
import { getBlogPost, getAllBlogPosts } from '@/lib/data/blog';
import { getWeekNumber } from '@/lib/weeks';
import { TopNav } from '@/components/TopNav';
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
    alternates: {
      canonical: `/blog/${post.slug}`,
    },
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
  const html = sanitizeHtml(markdownToHtml(post.body_markdown), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt'],
      a: ['href', 'class'],
    },
  });

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
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <TopNav />
      <main className="max-w-[900px] mx-auto px-5 py-6">
        <Link href="/blog" className="font-sans text-[10px] text-text-muted hover:text-text-primary no-underline">
          &larr; Back to blog
        </Link>

        <article className="mt-4">
          <h1 className="font-serif text-xl font-bold text-text-primary mb-2">{post.title}</h1>

          <div className="flex items-center gap-3 mb-6 font-sans text-[9px] text-text-muted">
            <time dateTime={post.published_at}>
              {new Date(post.published_at).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            </time>
            {weekNum && (
              <Link href={`/week/${post.week_id}`} className="text-text-primary hover:text-damage no-underline">
                Week {weekNum} Report &rarr;
              </Link>
            )}
          </div>

          <div
            className="prose-editorial"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          {post.week_id && (
            <div className="mt-6 p-3 rounded-[6px] bg-surface-overlay border border-surface-border">
              <p className="font-serif text-[13px] font-bold mb-1 text-text-primary">See the full interactive report</p>
              <Link
                href={`/week/${post.week_id}`}
                className="font-serif text-[13px] text-text-primary underline hover:text-damage"
              >
                Week {weekNum}: Full scores, smokescreen pairs, and source citations &rarr;
              </Link>
            </div>
          )}
        </article>

        <NewsletterSignup />
      </main>
    </div>
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
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-[#1A1A1A] underline hover:text-[#8B2020]">$1</a>');
}
