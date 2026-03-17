# Growth Engine Plan A: SEO Foundation

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build blog infrastructure and generate 59+ indexed blog posts from historical week data, plus RSS feed and structured data — creating an instant SEO content library.

**Architecture:** New `blog_posts` DB table stores auto-generated articles. A `/blog` Next.js route renders them with full SEO (JSON-LD, meta tags, internal links). A one-time backlog script uses Claude Haiku to generate posts for all frozen weeks. RSS feed and structured data completion round out discoverability.

**Tech Stack:** Next.js 16 App Router, Supabase (PostgreSQL), Claude Haiku API, Atom/RSS XML

---

## Task 1: Blog Posts Database Table

**Files:**
- Create: `supabase/migrations/20260316000001_blog_posts.sql`

- [ ] **Step 1: Write migration**

```sql
-- Blog posts table for auto-generated weekly content
CREATE TABLE IF NOT EXISTS distraction.blog_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  meta_description TEXT,
  body_markdown TEXT NOT NULL,
  week_id TEXT REFERENCES distraction.weekly_snapshots(week_id),
  keywords TEXT[] DEFAULT '{}',
  published_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  word_count INTEGER,
  generation_model TEXT,
  generation_tokens INTEGER
);

-- Index for blog listing and sitemap
CREATE INDEX idx_blog_posts_published ON distraction.blog_posts(published_at DESC);
CREATE INDEX idx_blog_posts_week ON distraction.blog_posts(week_id);

-- RLS: public read, admin write
ALTER TABLE distraction.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Blog posts are publicly readable"
  ON distraction.blog_posts FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage blog posts"
  ON distraction.blog_posts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

- [ ] **Step 2: Apply migration to Supabase**

Run against your Supabase project (via dashboard SQL editor or CLI):
```bash
# Copy the SQL and run in Supabase SQL Editor
# Or if using Supabase CLI:
npx supabase db push
```

- [ ] **Step 3: Verify table exists**

In Supabase SQL Editor:
```sql
SELECT * FROM distraction.blog_posts LIMIT 1;
```
Expected: Empty result set, no errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260316000001_blog_posts.sql
git commit -m "feat: add blog_posts table for auto-generated weekly content"
```

---

## Task 2: Blog Data Query Functions

**Files:**
- Create: `src/lib/data/blog.ts`

- [ ] **Step 1: Write blog data query module**

```typescript
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  meta_description: string | null;
  body_markdown: string;
  week_id: string | null;
  keywords: string[];
  published_at: string;
  updated_at: string;
  word_count: number | null;
}

/** Get all published blog posts, newest first */
export async function getAllBlogPosts(): Promise<BlogPost[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('blog_posts')
    .select('*')
    .order('published_at', { ascending: false });
  return (data ?? []) as BlogPost[];
}

/** Get a single blog post by slug */
export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .single();
  return data as BlogPost | null;
}

/** Get blog post by week_id (for checking if one already exists) */
export async function getBlogPostByWeek(weekId: string): Promise<BlogPost | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('week_id', weekId)
    .single();
  return data as BlogPost | null;
}

/** Insert a new blog post (admin/service role) */
export async function insertBlogPost(post: {
  slug: string;
  title: string;
  meta_description: string;
  body_markdown: string;
  week_id: string;
  keywords: string[];
  word_count: number;
  generation_model?: string;
  generation_tokens?: number;
}): Promise<BlogPost> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('blog_posts')
    .insert(post)
    .select()
    .single();
  if (error) throw new Error(`Failed to insert blog post: ${error.message}`);
  return data as BlogPost;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/data/blog.ts
git commit -m "feat: add blog data query functions"
```

---

## Task 3: Blog Post Generator (Claude Haiku)

**Files:**
- Create: `src/lib/blog/generate.ts`

- [ ] **Step 1: Write blog post generation module**

```typescript
import { callHaiku } from '@/lib/claude';
import { extractJSON } from '@/lib/claude';

export interface GeneratedBlogPost {
  title: string;
  meta_description: string;
  body_markdown: string;
  keywords: string[];
}

const SYSTEM_PROMPT = `You are a civic intelligence analyst writing for The Distraction Index — a weekly report that scores U.S. political events on two axes: constitutional damage (A-score) and distraction/hype (B-score).

Write an engaging, factual blog post analyzing this week's data. Your audience is politically engaged citizens who want to understand what's actually happening vs. what's dominating headlines.

Respond with JSON only:
{
  "title": "Compelling headline with the week's most striking finding",
  "meta_description": "150 char SEO description",
  "body_markdown": "800-1200 word markdown article with ## headers",
  "keywords": ["5-8 relevant SEO keywords"]
}

Guidelines:
- Lead with the most striking data point (highest damage score, biggest smokescreen gap)
- Use specific numbers and event names
- Explain what the scores mean for democracy in plain language
- End with a link to the full interactive report
- No partisan language — let the data speak
- Use ## for section headers, **bold** for emphasis, bullet lists for data`;

export async function generateBlogPost(weekData: {
  weekId: string;
  weekNumber: number;
  totalEvents: number;
  listA: Array<{ title: string; a_score: number; b_score: number }>;
  listB: Array<{ title: string; a_score: number; b_score: number }>;
  smokescreenCount: number;
  avgDamage: number;
  avgDistraction: number;
}): Promise<GeneratedBlogPost & { tokens: number; model: string }> {
  const userPrompt = `Generate a blog post for Week ${weekData.weekNumber} (${weekData.weekId}).

Data summary:
- ${weekData.totalEvents} events scored
- ${weekData.listA.length} high-damage events (List A)
- ${weekData.listB.length} high-distraction events (List B)
- ${weekData.smokescreenCount} smokescreen pairs detected
- Average damage: ${weekData.avgDamage.toFixed(1)}/100
- Average distraction: ${weekData.avgDistraction.toFixed(1)}/100

Top damage events:
${weekData.listA.slice(0, 5).map(e => `- "${e.title}" — Damage: ${e.a_score.toFixed(1)}, Distraction: ${e.b_score.toFixed(1)}`).join('\n')}

Top distraction events:
${weekData.listB.slice(0, 5).map(e => `- "${e.title}" — Distraction: ${e.b_score.toFixed(1)}, Damage: ${e.a_score.toFixed(1)}`).join('\n')}

Full report URL: https://distractionindex.org/week/${weekData.weekId}`;

  const response = await callHaiku(SYSTEM_PROMPT, userPrompt, 2048);
  const parsed = extractJSON<GeneratedBlogPost>(response.text);

  return {
    ...parsed,
    tokens: response.input_tokens + response.output_tokens,
    model: response.model,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/blog/generate.ts
git commit -m "feat: add Claude Haiku blog post generator"
```

---

## Task 4: Blog List Page (`/blog`)

**Files:**
- Create: `src/app/blog/page.tsx`

- [ ] **Step 1: Write blog list page**

```typescript
import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllBlogPosts } from '@/lib/data/blog';
import { getWeekNumber } from '@/lib/weeks';

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
                  <span>Week {getWeekNumber(post.week_id)}</span>
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
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/blog/page.tsx
git commit -m "feat: add blog list page"
```

---

## Task 5: Blog Detail Page (`/blog/[slug]`)

**Files:**
- Create: `src/app/blog/[slug]/page.tsx`

- [ ] **Step 1: Write blog detail page with JSON-LD**

```typescript
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getBlogPost, getAllBlogPosts } from '@/lib/data/blog';
import { getWeekNumber } from '@/lib/weeks';

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

export async function generateStaticParams() {
  const posts = await getAllBlogPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();

  const weekNum = post.week_id ? getWeekNumber(post.week_id) : null;

  // Simple markdown to HTML (headers, bold, bullets, links, paragraphs)
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
          ← Back to blog
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
                Week {weekNum} Report →
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
                Week {weekNum}: Full scores, smokescreen pairs, and source citations →
              </Link>
            </div>
          )}
        </article>
      </main>
    </>
  );
}

/** Minimal markdown → HTML converter for blog posts */
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
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-[var(--color-action)] hover:underline">$1</a>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" class="text-[var(--color-action)] hover:underline">$1</a>');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/blog/[slug]/page.tsx
git commit -m "feat: add blog detail page with JSON-LD and markdown rendering"
```

---

## Task 6: Backlog Generation Script

**Files:**
- Create: `scripts/generate-blog-backlog.ts`

- [ ] **Step 1: Write the backlog generation script**

```typescript
/**
 * Generate blog posts for all frozen weeks that don't have one yet.
 *
 * Usage:
 *   npx tsx scripts/generate-blog-backlog.ts              # Generate all missing
 *   npx tsx scripts/generate-blog-backlog.ts --dry-run     # Preview without writing
 *   npx tsx scripts/generate-blog-backlog.ts --week 2026-03-08  # Generate for one week
 */
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env.local') });

import { createAdminClient } from '../src/lib/supabase/admin';
import { generateBlogPost } from '../src/lib/blog/generate';
import { getWeekNumber } from '../src/lib/weeks';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const singleWeek = args.includes('--week') ? args[args.indexOf('--week') + 1] : null;

  const supabase = createAdminClient();

  // Get frozen weeks
  const query = supabase
    .from('weekly_snapshots')
    .select('week_id, status')
    .eq('status', 'frozen')
    .order('week_id', { ascending: true });

  if (singleWeek) query.eq('week_id', singleWeek);

  const { data: weeks } = await query;
  if (!weeks?.length) {
    console.log('No frozen weeks found.');
    return;
  }

  // Get existing blog posts
  const { data: existingPosts } = await supabase
    .from('blog_posts')
    .select('week_id');
  const existingWeekIds = new Set((existingPosts ?? []).map((p) => p.week_id));

  const missing = weeks.filter((w) => !existingWeekIds.has(w.week_id));
  console.log(`Found ${weeks.length} frozen weeks, ${missing.length} need blog posts.\n`);

  if (missing.length === 0) {
    console.log('All frozen weeks have blog posts. Nothing to do.');
    return;
  }

  let generated = 0;
  let failed = 0;
  let totalTokens = 0;

  for (const week of missing) {
    const weekNum = getWeekNumber(week.week_id);

    try {
      // Fetch week data
      const { data: events } = await supabase
        .from('events')
        .select('title, a_score, b_score, primary_list')
        .eq('week_id', week.week_id)
        .not('primary_list', 'is', null);

      const { data: pairs } = await supabase
        .from('smokescreen_pairs')
        .select('id')
        .eq('week_id', week.week_id);

      const allEvents = events ?? [];
      const listA = allEvents
        .filter((e) => e.primary_list === 'A')
        .sort((a, b) => (b.a_score || 0) - (a.a_score || 0));
      const listB = allEvents
        .filter((e) => e.primary_list === 'B')
        .sort((a, b) => (b.b_score || 0) - (a.b_score || 0));

      const avgDamage = allEvents.length > 0
        ? allEvents.reduce((s, e) => s + (e.a_score || 0), 0) / allEvents.length
        : 0;
      const avgDistraction = allEvents.length > 0
        ? allEvents.reduce((s, e) => s + (e.b_score || 0), 0) / allEvents.length
        : 0;

      if (allEvents.length === 0) {
        console.log(`  SKIP Week ${weekNum} (${week.week_id}) — no events`);
        continue;
      }

      console.log(`  Generating Week ${weekNum} (${week.week_id}) — ${allEvents.length} events...`);

      if (dryRun) {
        console.log(`    [DRY RUN] Would generate blog post`);
        generated++;
        continue;
      }

      const result = await generateBlogPost({
        weekId: week.week_id,
        weekNumber: weekNum,
        totalEvents: allEvents.length,
        listA: listA.map((e) => ({ title: e.title, a_score: e.a_score || 0, b_score: e.b_score || 0 })),
        listB: listB.map((e) => ({ title: e.title, a_score: e.a_score || 0, b_score: e.b_score || 0 })),
        smokescreenCount: pairs?.length ?? 0,
        avgDamage,
        avgDistraction,
      });

      const slug = `week-${weekNum}-${week.week_id}`;
      const wordCount = result.body_markdown.split(/\s+/).length;

      const { error } = await supabase.from('blog_posts').insert({
        slug,
        title: result.title,
        meta_description: result.meta_description,
        body_markdown: result.body_markdown,
        week_id: week.week_id,
        keywords: result.keywords,
        word_count: wordCount,
        generation_model: result.model,
        generation_tokens: result.tokens,
        published_at: new Date(week.week_id + 'T12:00:00Z').toISOString(),
      });

      if (error) {
        console.log(`    FAIL: ${error.message}`);
        failed++;
      } else {
        console.log(`    OK — "${result.title}" (${wordCount} words, ${result.tokens} tokens)`);
        generated++;
        totalTokens += result.tokens;
      }

      // Rate limit: 200ms between API calls
      await new Promise((r) => setTimeout(r, 200));
    } catch (err: any) {
      console.log(`    ERROR: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n=== COMPLETE ===`);
  console.log(`Generated: ${generated}, Failed: ${failed}, Total tokens: ${totalTokens}`);
  if (dryRun) console.log('(DRY RUN — nothing was written to database)');
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
```

- [ ] **Step 2: Add npm script to package.json**

Add to the `scripts` section:
```json
"blog:generate": "npx tsx scripts/generate-blog-backlog.ts",
"blog:generate:dry": "npx tsx scripts/generate-blog-backlog.ts --dry-run"
```

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-blog-backlog.ts package.json
git commit -m "feat: add blog backlog generation script (Claude Haiku)"
```

---

## Task 7: RSS Feed Route

**Files:**
- Create: `src/app/feed.xml/route.ts`

- [ ] **Step 1: Write RSS/Atom feed route**

```typescript
import { createAdminClient } from '@/lib/supabase/admin';

export const revalidate = 3600; // 1 hour cache

const BASE_URL = 'https://distractionindex.org';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const supabase = createAdminClient();

  const { data: posts } = await supabase
    .from('blog_posts')
    .select('slug, title, meta_description, published_at, updated_at, week_id')
    .order('published_at', { ascending: false })
    .limit(50);

  const items = (posts ?? [])
    .map((p) => `  <entry>
    <title>${escapeXml(p.title)}</title>
    <link href="${BASE_URL}/blog/${p.slug}" rel="alternate" type="text/html"/>
    <id>${BASE_URL}/blog/${p.slug}</id>
    <published>${p.published_at}</published>
    <updated>${p.updated_at}</updated>
    <summary>${escapeXml(p.meta_description ?? '')}</summary>
    <author><name>Steve Harlow</name></author>
  </entry>`)
    .join('\n');

  const latestDate = posts?.[0]?.updated_at ?? new Date().toISOString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>The Distraction Index Weekly</title>
  <subtitle>Weekly civic intelligence: tracking democratic damage vs. manufactured distractions.</subtitle>
  <link href="${BASE_URL}/feed.xml" rel="self" type="application/atom+xml"/>
  <link href="${BASE_URL}" rel="alternate" type="text/html"/>
  <id>${BASE_URL}/</id>
  <updated>${latestDate}</updated>
  <author><name>Steve Harlow</name></author>
  <icon>${BASE_URL}/favicon.ico</icon>
${items}
</feed>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
```

- [ ] **Step 2: Add feed link to layout.tsx metadata**

In `src/app/layout.tsx`, add to the metadata export:
```typescript
alternates: {
  types: {
    'application/atom+xml': '/feed.xml',
  },
},
```

- [ ] **Step 3: Add blog pages to sitemap**

In `src/app/sitemap.ts`, add after the existing queries:
```typescript
const { data: blogPosts } = await supabase
  .from('blog_posts')
  .select('slug, published_at, updated_at')
  .order('published_at', { ascending: false });

const blogPages: MetadataRoute.Sitemap = (blogPosts || []).map((p) => ({
  url: `${BASE_URL}/blog/${p.slug}`,
  lastModified: p.updated_at ?? p.published_at,
  changeFrequency: 'yearly' as const,
  priority: 0.7,
}));
```

Add `...blogPages` to the return array.

- [ ] **Step 4: Commit**

```bash
git add src/app/feed.xml/route.ts src/app/layout.tsx src/app/sitemap.ts
git commit -m "feat: add Atom RSS feed and blog pages to sitemap"
```

---

## Task 8: Structured Data Completion

**Files:**
- Modify: `src/app/week/[weekId]/page.tsx`
- Modify: `src/app/about/page.tsx`

- [ ] **Step 1: Add Dataset JSON-LD to week pages**

At the top of the week page's default export function, add:
```typescript
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  name: `Distraction Index — Week ${weekNum}`,
  description: `${totalEvents} political events scored for constitutional damage and media distraction. Week of ${weekId}.`,
  url: `https://distractionindex.org/week/${weekId}`,
  datePublished: snapshot.created_at,
  dateModified: snapshot.frozen_at ?? snapshot.created_at,
  creator: {
    '@type': 'Organization',
    name: 'The Distraction Index',
    url: 'https://distractionindex.org',
  },
  license: 'https://opensource.org/licenses/MIT',
  distribution: {
    '@type': 'DataDownload',
    contentUrl: `https://distractionindex.org/api/v1/weeks/${weekId}`,
    encodingFormat: 'application/json',
  },
};
```

Add the script tag in the JSX:
```typescript
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
/>
```

- [ ] **Step 2: Add Organization JSON-LD to about page**

Add to the about page:
```typescript
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'The Distraction Index',
  url: 'https://distractionindex.org',
  description: 'Independent civic intelligence platform tracking democratic damage vs. manufactured distractions.',
  foundingDate: '2024-12-29',
  founder: { '@type': 'Person', name: 'Steve Harlow' },
  sameAs: [
    'https://bsky.app/profile/sgharlow.bsky.social',
    'https://mastodon.social/@sgharlow',
    'https://www.threads.net/@distractionindex',
    'https://distractionindex.substack.com',
    'https://github.com/sgharlow/distraction',
  ],
};
```

- [ ] **Step 3: Commit**

```bash
git add src/app/week/[weekId]/page.tsx src/app/about/page.tsx
git commit -m "feat: add Dataset and Organization JSON-LD structured data"
```

---

## Task 9: Add Blog Link to Navigation

**Files:**
- Modify: `src/components/TopNav.tsx` (or equivalent nav component)

- [ ] **Step 1: Add /blog link to the site navigation**

Find the navigation component and add a Blog link alongside existing nav items (Methodology, Smokescreen, etc.).

- [ ] **Step 2: Build and verify**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/
git commit -m "feat: add blog link to site navigation"
```

---

## Execution Sequence

After all tasks are committed:

1. Apply migration (Task 1)
2. Run `npm run build` to verify blog routes compile
3. Run `npm run blog:generate:dry` to preview backlog generation
4. Run `npm run blog:generate` to generate all 59 blog posts (~$1.20)
5. Deploy to Vercel: `git push`
6. Verify: visit distractionindex.org/blog, /feed.xml, check Google Search Console

---

## Plan B (Content Automation) — Separate Document

Covers: freeze cascade enhancement, event-driven alerts, automated Substack publishing, content recycling variants, and directory submissions. To be implemented after Plan A is deployed and blog posts are indexed.
