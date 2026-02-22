import { createAdminClient } from '@/lib/supabase/admin';

export const revalidate = 3600; // revalidate every hour

export async function GET() {
  const supabase = createAdminClient();

  // Google News sitemaps should only include content from the last 48 hours
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: events } = await supabase
    .from('events')
    .select('id, title, event_date, created_at, topic_tags')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(100);

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
