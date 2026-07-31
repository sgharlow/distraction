// ═══════════════════════════════════════════════════════════════
// Alert delivery for the dead-man's-switch.
//
// Uses Resend via raw REST (same pattern as blog/cascade.ts emailSubscribers)
// — deliberately NOT going through Supabase, so the alert still sends when
// Supabase is the thing that's down (the July 2026 paused-project outage).
// ═══════════════════════════════════════════════════════════════

import type { FreshnessStatus } from './freshness';
import type { StuckWeekStatus } from './stuck-week';

export interface HealthReport {
  freshness: FreshnessStatus;
  stuck: StuckWeekStatus | null;
}

export interface AlertResult {
  sent: boolean;
  skippedReason?: string;
  error?: string;
}

/** Freshness problems are CRITICAL (data not flowing); a stuck week alone is a WARNING. */
function severity(report: HealthReport): 'critical' | 'warning' {
  return report.freshness.healthy ? 'warning' : 'critical';
}

/**
 * Email an operator when the pipeline is unhealthy: stale/unreachable ingest
 * (critical) and/or a week stuck 'live' past its freeze window (warning).
 *
 * Config (not secrets — safe as plain env):
 *   ALERT_EMAIL          recipient (required; without it we skip, and say so)
 *   OUTREACH_FROM_EMAIL  from address (shared with cascade.ts; falls back to resend.dev)
 * Secret:
 *   RESEND_API_KEY       already provisioned for subscriber emails
 *
 * @param fetchImpl injectable fetch for tests (defaults to global fetch)
 */
export async function sendHealthAlert(
  report: HealthReport,
  fetchImpl: typeof fetch = fetch,
): Promise<AlertResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL;

  if (!apiKey) return { sent: false, skippedReason: 'RESEND_API_KEY not set' };
  if (!to) return { sent: false, skippedReason: 'ALERT_EMAIL not set' };

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://distractionindex.org';
  const { freshness, stuck } = report;
  const level = severity(report);

  const subject =
    level === 'critical'
      ? `⚠️ Distraction Index pipeline ${freshness.state.toUpperCase()} — ingest not landing data`
      : `⚠️ Distraction Index — week freeze missed (${stuck?.stuckWeeks.join(', ') ?? 'stuck week'})`;

  const lines: string[] = ['The Distraction Index dead-man\'s-switch fired.', ''];

  // Ingest freshness section (always shown).
  lines.push('── Ingest freshness ──');
  lines.push(`State:            ${freshness.state}${freshness.healthy ? ' (ok)' : ''}`);
  lines.push(`Detail:           ${freshness.detail}`);
  lines.push(`Last good ingest: ${freshness.lastSuccessfulIngestAt ?? 'none found'}`);
  lines.push(
    `Age:              ${freshness.ageHours == null ? 'n/a' : `${freshness.ageHours}h`} (threshold ${freshness.thresholdHours}h)`,
  );

  // Stuck-week section (only when there is something to say).
  if (stuck && stuck.state !== 'ok') {
    lines.push('', '── Week freeze ──');
    lines.push(`State:            ${stuck.state}`);
    lines.push(`Detail:           ${stuck.detail}`);
  }

  lines.push(
    '',
    'Likely causes: Supabase project paused, all ingestion feeds rate-limited/blocked,',
    'the ingest cron stopped firing, or a Sunday freeze cron was missed. Check the',
    'Supabase project state first (that was the July 2026 root cause), then the Vercel',
    'cron logs for /api/ingest and /api/freeze.',
    '',
    `Health endpoint: ${site}/api/health`,
    `Site:            ${site}`,
  );

  try {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: process.env.OUTREACH_FROM_EMAIL ?? 'onboarding@resend.dev',
        to,
        subject,
        text: lines.join('\n'),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { sent: false, error: `Resend responded ${res.status}: ${detail.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { sent: false, error: `Alert send threw: ${msg}` };
  }
}
