import type { MetadataRoute } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';

const BASE_URL = 'https://distractionindex.org';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createAdminClient();

  const [{ data: weeks }, { data: blogPosts }] = await Promise.all([
    supabase
      .from('weekly_snapshots')
      .select('week_id, status, frozen_at, created_at')
      .order('week_id', { ascending: false }),
    supabase
      .from('blog_posts')
      .select('slug, published_at, updated_at')
      .order('published_at', { ascending: false }),
  ]);

  // Static pages — only substantive, unique-content pages
  // Excludes / (redirects to /week/current) and /search (thin query page)
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/week/current`, changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE_URL}/methodology`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/smokescreen`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/undercovered`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/timeline`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/corrections`, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${BASE_URL}/topic`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE_URL}/blog`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/about`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/contact`, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${BASE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
  ];

  // Week pages — frozen weeks have substantial unique content
  const weekPages: MetadataRoute.Sitemap = (weeks || []).map((w) => ({
    url: `${BASE_URL}/week/${w.week_id}`,
    lastModified: w.frozen_at ?? w.created_at,
    changeFrequency: w.status === 'frozen' ? 'yearly' as const : 'daily' as const,
    priority: w.status === 'frozen' ? 0.6 : 0.9,
  }));

  // Blog posts — unique editorial content, always worth indexing
  const blogPages: MetadataRoute.Sitemap = (blogPosts || []).map((p) => ({
    url: `${BASE_URL}/blog/${p.slug}`,
    lastModified: p.updated_at ?? p.published_at,
    changeFrequency: 'yearly' as const,
    priority: 0.7,
  }));

  // Intentionally excluded from sitemap:
  // - /event/[id] pages: hundreds of thin/repetitive pages that waste crawl budget
  // - /topic/[tag] pages: auto-generated tag listings with no unique content
  // - / (root): redirects to /week/current
  // - /search: query-dependent, no static content
  // These pages remain accessible and linked from indexed pages,
  // but are not actively submitted for indexing.

  return [...staticPages, ...weekPages, ...blogPages];
}
