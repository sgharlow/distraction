/**
 * Run-outcome rules for the unattended outreach jobs (scheduler.ts, run-all.ts,
 * substack-publish.ts).
 *
 * Why this exists: every one of those scripts used to exit 0 no matter what
 * happened — scheduler.ts called process.exit(0) after "Result: 0/5 platforms
 * succeeded" just as happily as after 5/5. Windows Task Scheduler's
 * LastTaskResult (and TaskDeck's red/green tray icon, which reads it) was
 * therefore meaningless. A failing run must exit non-zero and say why.
 *
 * Platform policy for a scheduled social slot:
 *   - REQUIRED  bluesky, mastodon, linkedin  → any failure fails the run
 *   - OPTIONAL  twitter                      → failure is a logged warning only
 *                (X API credits are depleted; dropping X is Steve's call, so it
 *                 stays wired but can no longer turn a run red)
 *   - DISABLED  threads                      → ignored (switched off in code)
 * No I/O here beyond the injected logger, so it is unit-testable.
 */

export interface PlatformResult {
  success: boolean;
  error?: string;
}

export interface SlotPlatformResults {
  bluesky: PlatformResult;
  mastodon: PlatformResult;
  threads: PlatformResult;
  linkedin: PlatformResult;
  twitter: PlatformResult;
}

export const REQUIRED_PLATFORMS = ['bluesky', 'mastodon', 'linkedin'] as const;
export const OPTIONAL_PLATFORMS = ['twitter'] as const;

export interface PostOutcome {
  ok: boolean;
  /** One line per REQUIRED platform that failed: "<platform>: <error>". */
  failed: string[];
  /** One line per OPTIONAL platform that failed. Never affects `ok`. */
  warnings: string[];
}

export function evaluatePostOutcome(results: SlotPlatformResults): PostOutcome {
  const failed: string[] = [];
  const warnings: string[] = [];

  for (const platform of REQUIRED_PLATFORMS) {
    const r = results[platform];
    // Fail closed: a missing result is a failure, not a pass.
    if (!r) failed.push(`${platform}: no result recorded`);
    else if (!r.success) failed.push(`${platform}: ${r.error ?? 'unknown error'}`);
  }

  for (const platform of OPTIONAL_PLATFORMS) {
    const r = results[platform];
    if (r && !r.success) warnings.push(`${platform} (non-fatal): ${r.error ?? 'unknown error'}`);
  }

  return { ok: failed.length === 0, failed, warnings };
}

interface RunLogger {
  log: (msg: string) => void;
  error: (msg: string) => void;
}

/**
 * Log the run verdict and return the process exit code (0 = ok, 1 = failed).
 * Callers set `process.exitCode` / call `process.exit` with the result.
 */
export function finishRun(label: string, failures: string[], logger: RunLogger = console): number {
  if (failures.length === 0) {
    logger.log(`[${label}] RUN OK at ${new Date().toISOString()}`);
    return 0;
  }
  logger.error(`[${label}] RUN FAILED (${failures.length}) at ${new Date().toISOString()}:`);
  for (const f of failures) logger.error(`  - ${f}`);
  return 1;
}
