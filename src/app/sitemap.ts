import type { MetadataRoute } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';

const BASE_URL = 'https://distractionindex.org';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createAdminClient();

  const [{ data: weeks }, { data: events }, { data: topicRows }] = await Promise.all([
    supabase
      .from('weekly_snapshots')
      .select('week_id, status, frozen_at, created_at')
      .order('week_id', { ascending: false }),
    supabase
      .from('events')
      .select('id, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1000),
    supabase
      .from('events')
      .select('topic_tags')
      .not('topic_tags', 'is', null),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE_URL}/methodology`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/corrections`, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${BASE_URL}/smokescreen`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/undercovered`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/timeline`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE_URL}/search`, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${BASE_URL}/topic`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE_URL}/about`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/contact`, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${BASE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
  ];

  const weekPages: MetadataRoute.Sitemap = (weeks || []).map((w) => ({
    url: `${BASE_URL}/week/${w.week_id}`,
    lastModified: w.frozen_at ?? w.created_at,
    changeFrequency: w.status === 'frozen' ? 'yearly' as const : 'daily' as const,
    priority: w.status === 'frozen' ? 0.6 : 0.9,
  }));

  const eventPages: MetadataRoute.Sitemap = (events || []).map((e) => ({
    url: `${BASE_URL}/event/${e.id}`,
    lastModified: e.updated_at,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }));

  // Collect unique topic tags for topic pages
  const uniqueTags = new Set<string>();
  for (const row of topicRows || []) {
    if (Array.isArray(row.topic_tags)) {
      for (const tag of row.topic_tags) {
        uniqueTags.add(tag);
      }
    }
  }

  const topicPages: MetadataRoute.Sitemap = Array.from(uniqueTags).map((tag) => ({
    url: `${BASE_URL}/topic/${encodeURIComponent(tag)}`,
    changeFrequency: 'weekly' as const,
    priority: 0.4,
  }));

  return [...staticPages, ...weekPages, ...eventPages, ...topicPages];
}
