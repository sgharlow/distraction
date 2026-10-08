/**
 * Substack weekly-publish dead-man check (run by .github/workflows/substack-deadman.yml).
 *
 * Does NOT contact Substack (it answers HTTP 403 to GitHub-hosted runners). It
 * judges the heartbeat the verified Sunday publish writes to the GitHub Actions
 * repository variable SUBSTACK_LAST_PUBLISHED_WEEK; the workflow passes it in as
 * the env var of the same name (and SUBSTACK_LAST_PUBLISHED_AT, shown only).
 * Writes state/week/newest/reason to $GITHUB_OUTPUT when set, and prints the
 * verdict as one JSON line.
 *
 * Exit 0 = OK, 1 = MISSING or ERROR. Any crash inside main() is caught and written
 * as state=ERROR (fail-closed); a crash before main() writes nothing, and the
 * workflow treats a missing state as ERROR too.
 *
 * It ALERTS only. Never use it to decide to re-publish.
 *
 * Usage (locally, reading the live variable):
 *   SUBSTACK_LAST_PUBLISHED_WEEK=$(gh variable get SUBSTACK_LAST_PUBLISHED_WEEK -R sgharlow/distraction) \
 *     npx tsx scripts/outreach/substack-deadman.ts [--as-of 2026-10-12T15:00:00Z]
 */
import { appendFileSync } from 'fs';
import { evaluateHeartbeat, expectedWeek, HEARTBEAT_VAR, type Verdict } from '../../src/lib/monitor/substack-deadman';

function parseAsOf(argv: string[]): Date {
  const i = argv.indexOf('--as-of');
  if (i === -1) return new Date();
  const raw = argv[i + 1];
  const d = new Date(raw ?? '');
  if (!raw || Number.isNaN(d.getTime())) throw new Error(`--as-of needs an ISO timestamp (got ${raw})`);
  return d;
}

function writeOutputs(v: { state: string; expected: number | null; newest: number | null; reason: string }) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) return;
  const oneLine = v.reason.replace(/[\r\n]+/g, ' ');
  appendFileSync(
    file,
    `state=${v.state}\nweek=${v.expected ?? ''}\nnewest=${v.newest ?? ''}\nreason=${oneLine}\n`,
  );
}

async function main(): Promise<Verdict> {
  const asOf = parseAsOf(process.argv.slice(2));
  const expected = expectedWeek(asOf);
  const verdict = evaluateHeartbeat(process.env[HEARTBEAT_VAR], expected);
  const at = (process.env.SUBSTACK_LAST_PUBLISHED_AT ?? '').trim().slice(0, 40);
  const when = at ? ` (heartbeat written ${at})` : '';
  return { ...verdict, reason: `as of ${asOf.toISOString()}: ${verdict.reason}${when}` };
}

main()
  .then((v) => {
    writeOutputs(v);
    console.log(JSON.stringify(v));
    process.exit(v.state === 'OK' ? 0 : 1);
  })
  .catch((err) => {
    const reason = `check crashed: ${err instanceof Error ? err.message : String(err)}`;
    const v = { state: 'ERROR', expected: null, newest: null, reason };
    try {
      writeOutputs(v);
    } catch {
      // The workflow treats a missing state as ERROR, so a failed write still alerts.
    }
    console.error(JSON.stringify(v));
    process.exit(1);
  });
