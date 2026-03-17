/**
 * Freeze Cascade: One freeze → 6+ pieces of content, zero human intervention.
 *
 * Called after /api/freeze successfully freezes a week.
 * Generates blog post, posts to social (API-only), emails subscribers, pings Google.
 *
 * Designed to complete within Vercel's 30s timeout.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { callHaiku, extractJSON } from '@/lib/claude';
import { getWeekNumber } from '@/lib/weeks';

interface CascadeResult {
  blog: { success: boolean; slug?: string; error?: string };
  social: { bluesky: boolean; mastodon: boolean; errors: string[] };
  email: { sent: number; error?: string };
  sitemap: { pinged: boolean };
}

/** Generate a blog post for the frozen week */
async function generateBlogPost(weekId: string): Promise<{ slug: string } | null> {
  const supabase = createAdminClient();

  // Check if blog post already exists
  const { data: existing } = await supabase
    .from('blog_posts')
    .select('slug')
    .eq('week_id', weekId)
    .single();
  if (existing) return { slug: existing.slug };

  // Fetch week data
  const { data: events } = await supabase
    .from('events')
    .select('title, a_score, b_score, primary_list')
    .eq('week_id', weekId)
    .not('primary_list', 'is', null);

  const { data: pairs } = await supabase
    .from('smokescreen_pairs')
    .select('id')
    .eq('week_id', weekId);

  const allEvents = events ?? [];
  if (allEvents.length === 0) return null;

  const listA = allEvents.filter(e => e.primary_list === 'A').sort((a, b) => (b.a_score || 0) - (a.a_score || 0));
  const listB = allEvents.filter(e => e.primary_list === 'B').sort((a, b) => (b.b_score || 0) - (a.b_score || 0));
  const avgDamage = allEvents.reduce((s, e) => s + (e.a_score || 0), 0) / allEvents.length;
  const avgDistraction = allEvents.reduce((s, e) => s + (e.b_score || 0), 0) / allEvents.length;
  const weekNum = getWeekNumber(new Date(weekId));

  const system = `You are a civic intelligence analyst writing for The Distraction Index. Write an engaging blog post analyzing this week's data. Respond with JSON only: {"title":"headline","meta_description":"150 chars","body_markdown":"800-1200 word article","keywords":["5-8 terms"]}`;

  const user = `Week ${weekNum} (${weekId}): ${allEvents.length} events. Top damage: ${listA[0]?.title ?? 'none'} (${listA[0]?.a_score?.toFixed(1) ?? 0}). Top distraction: ${listB[0]?.title ?? 'none'} (${listB[0]?.b_score?.toFixed(1) ?? 0}). ${pairs?.length ?? 0} smokescreen pairs. Avg damage: ${avgDamage.toFixed(1)}. Avg distraction: ${avgDistraction.toFixed(1)}. Report: https://distractionindex.org/week/${weekId}`;

  const response = await callHaiku(system, user, 2048);
  const parsed = extractJSON<{ title: string; meta_description: string; body_markdown: string; keywords: string[] }>(response.text);

  const slug = `week-${weekNum}-${weekId}`;
  const wordCount = parsed.body_markdown.split(/\s+/).length;

  const { error } = await supabase.from('blog_posts').insert({
    slug,
    title: parsed.title,
    meta_description: parsed.meta_description,
    body_markdown: parsed.body_markdown,
    week_id: weekId,
    keywords: parsed.keywords,
    word_count: wordCount,
    generation_model: response.model,
    generation_tokens: response.input_tokens + response.output_tokens,
  });

  if (error) throw new Error(error.message);
  return { slug };
}

/** Post weekly summary to Bluesky + Mastodon (API only — works on serverless) */
async function postToSocial(weekId: string): Promise<{ bluesky: boolean; mastodon: boolean; errors: string[] }> {
  const errors: string[] = [];
  let bluesky = false;
  let mastodon = false;

  const supabase = createAdminClient();
  const { data: events } = await supabase
    .from('events')
    .select('title, a_score, b_score, primary_list')
    .eq('week_id', weekId)
    .not('primary_list', 'is', null);

  const allEvents = events ?? [];
  const topDamage = allEvents.filter(e => e.primary_list === 'A').sort((a, b) => (b.a_score || 0) - (a.a_score || 0))[0];
  const weekNum = getWeekNumber(new Date(weekId));

  const text = `Week ${weekNum} of the Distraction Index is now frozen.\n\n${allEvents.length} events scored. ${topDamage ? `Highest damage: "${topDamage.title}" (${topDamage.a_score?.toFixed(1)}/100).` : ''}\n\nFull report: https://distractionindex.org/week/${weekId}\nBlog analysis: https://distractionindex.org/blog/week-${weekNum}-${weekId}`;

  // Bluesky
  try {
    const handle = process.env.BLUESKY_HANDLE;
    const password = process.env.BLUESKY_APP_PASSWORD;
    if (handle && password) {
      const sessionRes = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: handle, password }),
      });
      const session = await sessionRes.json();
      if (session.accessJwt) {
        const postRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.accessJwt}` },
          body: JSON.stringify({
            repo: session.did,
            collection: 'app.bsky.feed.post',
            record: { $type: 'app.bsky.feed.post', text, createdAt: new Date().toISOString(), langs: ['en'] },
          }),
        });
        bluesky = postRes.ok;
      }
    }
  } catch (e: any) { errors.push(`Bluesky: ${e.message}`); }

  // Mastodon
  try {
    const instance = process.env.MASTODON_INSTANCE;
    const token = process.env.MASTODON_ACCESS_TOKEN;
    if (instance && token) {
      const mastoText = text + '\n\n#DistractionIndex #Democracy #CivicTech';
      const res = await fetch(`${instance}/api/v1/statuses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: mastoText, visibility: 'public', language: 'en' }),
      });
      mastodon = res.ok;
    }
  } catch (e: any) { errors.push(`Mastodon: ${e.message}`); }

  return { bluesky, mastodon, errors };
}

/** Email subscribers about the new week */
async function emailSubscribers(weekId: string): Promise<{ sent: number }> {
  const supabase = createAdminClient();
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: 0 };

  const { data: subscribers } = await supabase
    .from('email_subscribers')
    .select('email')
    .eq('confirmed', true)
    .is('unsubscribed_at', null);

  if (!subscribers?.length) return { sent: 0 };

  const weekNum = getWeekNumber(new Date(weekId));
  const { data: blogPost } = await supabase
    .from('blog_posts')
    .select('title, meta_description')
    .eq('week_id', weekId)
    .single();

  const subject = blogPost?.title ?? `Week ${weekNum} Distraction Index Report`;
  const body = `${blogPost?.meta_description ?? 'This week\'s Distraction Index is ready.'}\n\nRead the full analysis: https://distractionindex.org/blog/week-${weekNum}-${weekId}\n\nSee the interactive report: https://distractionindex.org/week/${weekId}\n\n—\nThe Distraction Index Weekly\nhttps://distractionindex.org`;

  let sent = 0;
  for (const sub of subscribers.slice(0, 100)) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          from: process.env.OUTREACH_FROM_EMAIL ?? 'onboarding@resend.dev',
          to: sub.email,
          subject,
          text: body,
        }),
      });
      if (res.ok) sent++;
    } catch { /* skip failed sends */ }
  }

  return { sent };
}

/** Ping Google to re-crawl the sitemap */
async function pingSitemap(): Promise<boolean> {
  try {
    const res = await fetch('https://www.google.com/ping?sitemap=https://distractionindex.org/sitemap.xml');
    return res.ok;
  } catch { return false; }
}

/** Run the full freeze cascade */
export async function runFreezeCascade(weekId: string): Promise<CascadeResult> {
  const result: CascadeResult = {
    blog: { success: false },
    social: { bluesky: false, mastodon: false, errors: [] },
    email: { sent: 0 },
    sitemap: { pinged: false },
  };

  // 1. Generate blog post (~3-5s)
  try {
    const blog = await generateBlogPost(weekId);
    result.blog = { success: true, slug: blog?.slug };
  } catch (e: any) {
    result.blog = { success: false, error: e.message };
  }

  // 2-4 in parallel (~2-3s total)
  const [social, email, pinged] = await Promise.all([
    postToSocial(weekId).catch(e => ({ bluesky: false, mastodon: false, errors: [e.message] })),
    emailSubscribers(weekId).catch(() => ({ sent: 0 })),
    pingSitemap(),
  ]);

  result.social = social;
  result.email = email;
  result.sitemap = { pinged };

  return result;
}
