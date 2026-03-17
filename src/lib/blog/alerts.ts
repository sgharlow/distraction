/**
 * Event-Driven Alerts: Post to Bluesky + Mastodon when a_score > 80.
 * Called from /api/process after scoring completes.
 * Only uses API-based platforms (works on Vercel serverless).
 */
import { createAdminClient } from '@/lib/supabase/admin';

interface AlertResult {
  event_id: string;
  title: string;
  a_score: number;
  bluesky: boolean;
  mastodon: boolean;
}

/** Check for high-damage events scored in the current process cycle and alert */
export async function checkAndAlertHighDamage(scoredEventIds: string[]): Promise<AlertResult[]> {
  if (!scoredEventIds.length) return [];

  const supabase = createAdminClient();
  const results: AlertResult[] = [];

  // Find events with a_score > 80 among those just scored
  const { data: highDamage } = await supabase
    .from('events')
    .select('id, title, a_score, b_score, week_id')
    .in('id', scoredEventIds)
    .gt('a_score', 80)
    .order('a_score', { ascending: false })
    .limit(2); // Max 2 alerts per cycle

  if (!highDamage?.length) return [];

  // Check we haven't already alerted for these (dedup via pipeline_runs metadata)
  const { data: recentAlerts } = await supabase
    .from('pipeline_runs')
    .select('metadata')
    .eq('run_type', 'alert')
    .gte('completed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const alertedIds = new Set<string>();
  for (const run of recentAlerts ?? []) {
    const meta = run.metadata as Record<string, unknown> | null;
    if (meta?.event_id) alertedIds.add(meta.event_id as string);
  }

  for (const event of highDamage) {
    if (alertedIds.has(event.id)) continue;

    const text = `ALERT: "${event.title}" just scored ${event.a_score.toFixed(1)}/100 for constitutional damage on the Distraction Index.\n\nThat's in the top tier of democratic harm we've tracked across 60+ weeks.\n\nFull details: https://distractionindex.org/event/${event.id}`;

    let bluesky = false;
    let mastodon = false;

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
    } catch { /* non-fatal */ }

    // Mastodon
    try {
      const instance = process.env.MASTODON_INSTANCE;
      const token = process.env.MASTODON_ACCESS_TOKEN;
      if (instance && token) {
        const mastoText = text + '\n\n#DistractionIndex #Democracy #ConstitutionalDamage';
        const res = await fetch(`${instance}/api/v1/statuses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ status: mastoText, visibility: 'public', language: 'en' }),
        });
        mastodon = res.ok;
      }
    } catch { /* non-fatal */ }

    // Log the alert
    await supabase.from('pipeline_runs').insert({
      run_type: 'alert',
      status: 'completed',
      completed_at: new Date().toISOString(),
      metadata: { event_id: event.id, title: event.title, a_score: event.a_score, bluesky, mastodon },
    });

    results.push({ event_id: event.id, title: event.title, a_score: event.a_score, bluesky, mastodon });
  }

  return results;
}
