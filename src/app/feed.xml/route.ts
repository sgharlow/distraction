import { createAdminClient } from '@/lib/supabase/admin';

export const revalidate = 3600;

const BASE_URL = 'https://distractionindex.org';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Build-safe by design. Every Vercel env var on this project is Production-scoped, so a preview
// build has no Supabase URL or key — and `next build` prerenders this route (revalidate = 3600).
// Without a database the feed is VALID AND EMPTY, never a build failure: until 2026-09-25 every
// preview deployment died here ("supabaseUrl is required"), which put a red Vercel check on every
// PR, Dependabot's included. Production, which has the env, is unchanged. tests/api/feed.test.ts
// pins both branches.
type FeedPost = {
  slug: string;
  title: string;
  meta_description: string | null;
  published_at: string;
  updated_at: string;
  week_id: string;
};

function hasDatabase(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function loadPosts(): Promise<FeedPost[]> {
  if (!hasDatabase()) return [];
  const supabase = createAdminClient();
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('slug, title, meta_description, published_at, updated_at, week_id')
    .order('published_at', { ascending: false })
    .limit(50);
  return (posts ?? []) as FeedPost[];
}

export async function GET() {
  const posts = await loadPosts();

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
