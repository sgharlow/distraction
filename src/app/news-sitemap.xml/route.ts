import { createAdminClient } from '@/lib/supabase/admin';
import { hasDatabase } from '@/lib/supabase/env';

export const revalidate = 3600; // revalidate every hour

type NewsEvent = {
  id: string;
  title: string;
  event_date: string | null;
  created_at: string;
  topic_tags: string[] | null;
};

// Build-safe: without a database (a preview build — see src/lib/supabase/env.ts) the sitemap is
// VALID AND EMPTY, never a build failure. tests/api/news-sitemap.test.ts pins both branches.
async function loadRecentEvents(cutoff: string): Promise<NewsEvent[]> {
  if (!hasDatabase()) return [];
  const supabase = createAdminClient();
  const { data: events } = await supabase
    .from('events')
    .select('id, title, event_date, created_at, topic_tags')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(100);
  return (events ?? []) as NewsEvent[];
}

export async function GET() {
  // Google News sitemaps should only include content from the last 48 hours
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const events = await loadRecentEvents(cutoff);

  const items = (events ?? [])
    .map((e) => {
      const keywords = e.topic_tags?.join(', ') ?? '';
      return `  <url>
    <loc>https://distractionindex.org/event/${e.id}</loc>
    <news:news>
      <news:publication>
        <news:name>The Distraction Index</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${e.event_date || e.created_at}</news:publication_date>
      <news:title>${escapeXml(e.title)}</news:title>${keywords ? `\n      <news:keywords>${escapeXml(keywords)}</news:keywords>` : ''}
    </news:news>
  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${items}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
