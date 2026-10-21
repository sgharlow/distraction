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
 *   - REQUIRED  bluesky, mastodon, linkedin  → any failure fails the run, while the
 *                platform is enabled
 *   - OPTIONAL  twitter                      → failure is a logged warning only,
 *                while X is enabled
 *   - DISABLED  threads, twitter, linkedin   → never called, never a failure or a
 *                warning, and left out of the "N/M platforms succeeded" count. Steve
 *                switched X off on 2026-10-20 (API credits depleted since 2026-08-28)
 *                and retired LinkedIn's browser automation the same day, when the
 *                slots moved to GitHub Actions (.github/workflows/outreach-post.yml).
 *                Remove a platform from DISABLED_PLATFORMS to turn it back on.
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

export type SlotPlatform = keyof SlotPlatformResults;

export const DISABLED_PLATFORMS: readonly SlotPlatform[] = ['threads', 'twitter', 'linkedin'];

const DISABLED_REASON: Partial<Record<SlotPlatform, string>> = {
  threads: 'Threads posting disabled (Meta UI instability)',
  twitter: 'X posting disabled (API credits depleted since 2026-08-28; Steve 2026-10-20)',
  linkedin: 'LinkedIn posting disabled (browser automation retired when posting moved to GitHub Actions; Steve 2026-10-20)',
};

const PLATFORM_LABEL: Record<SlotPlatform, string> = {
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  threads: 'Threads',
  linkedin: 'LinkedIn',
  twitter: 'Twitter/X',
};

const ALL_PLATFORMS: readonly SlotPlatform[] = ['bluesky', 'mastodon', 'threads', 'linkedin', 'twitter'];

export function isPlatformDisabled(platform: SlotPlatform, disabled: readonly SlotPlatform[] = DISABLED_PLATFORMS): boolean {
  return disabled.includes(platform);
}

/** The result recorded for a switched-off platform: same shape as a real attempt. */
export function disabledResult(platform: SlotPlatform): PlatformResult {
  return { success: false, error: DISABLED_REASON[platform] ?? `${PLATFORM_LABEL[platform]} posting disabled` };
}

/** Display names of the platforms a slot actually posts to, for the startup banner. */
export function activePlatformNames(disabled: readonly SlotPlatform[] = DISABLED_PLATFORMS): string[] {
  return ALL_PLATFORMS.filter(p => !disabled.includes(p)).map(p => PLATFORM_LABEL[p]);
}

/** Success count over switched-on platforms only, for the "N/M platforms succeeded" line. */
export function countPlatforms(
  results: SlotPlatformResults,
  disabled: readonly SlotPlatform[] = DISABLED_PLATFORMS,
): { succeeded: number; total: number } {
  const active = ALL_PLATFORMS.filter(p => !disabled.includes(p));
  return { succeeded: active.filter(p => results[p]?.success).length, total: active.length };
}

export interface PostOutcome {
  ok: boolean;
  /** One line per REQUIRED platform that failed: "<platform>: <error>". */
  failed: string[];
  /** One line per OPTIONAL platform that failed. Never affects `ok`. */
  warnings: string[];
}

export function evaluatePostOutcome(
  results: SlotPlatformResults,
  disabled: readonly SlotPlatform[] = DISABLED_PLATFORMS,
): PostOutcome {
  const failed: string[] = [];
  const warnings: string[] = [];

  for (const platform of REQUIRED_PLATFORMS) {
    // A switched-off platform is never called, so it can never fail the run.
    if (disabled.includes(platform)) continue;
    const r = results[platform];
    // Fail closed: a missing result is a failure, not a pass.
    if (!r) failed.push(`${platform}: no result recorded`);
    else if (!r.success) failed.push(`${platform}: ${r.error ?? 'unknown error'}`);
  }

  for (const platform of OPTIONAL_PLATFORMS) {
    if (disabled.includes(platform)) continue;
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
