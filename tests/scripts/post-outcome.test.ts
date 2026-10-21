import { describe, it, expect, vi } from 'vitest';
import {
  evaluatePostOutcome,
  countPlatforms,
  disabledResult,
  isPlatformDisabled,
  activePlatformNames,
  finishRun,
  type SlotPlatformResults,
} from '../../scripts/outreach/post-outcome';

const OK = { success: true };
const fail = (error: string) => ({ success: false, error });

// The exact per-platform shape scheduler.ts produced on 2026-09-05 (3/5 "succeeded").
const SEPT_5: SlotPlatformResults = {
  bluesky: OK,
  mastodon: OK,
  threads: fail('Threads posting disabled (Meta UI instability)'),
  linkedin: OK,
  twitter: fail('Tweet failed: 402 {"detail":"credits depleted"}'),
};

// The shape scheduler.ts records once X is switched off (Steve, 2026-10-20).
const OCT_20: SlotPlatformResults = { ...SEPT_5, twitter: disabledResult('twitter') };

// ...and once LinkedIn is switched off too (browser automation retired, Steve 2026-10-20).
const OCT_21: SlotPlatformResults = { ...OCT_20, linkedin: disabledResult('linkedin') };

describe('disabled platforms (X 2026-10-20, LinkedIn 2026-10-21)', () => {
  it('lists Threads, X and LinkedIn as disabled, and no other platform', () => {
    for (const p of ['threads', 'twitter', 'linkedin'] as const) expect(isPlatformDisabled(p)).toBe(true);
    for (const p of ['bluesky', 'mastodon'] as const) expect(isPlatformDisabled(p)).toBe(false);
  });

  it('records a disabled LinkedIn slot with the ruling as its error', () => {
    expect(disabledResult('linkedin').error).toMatch(/browser automation retired/);
  });

  it('never fails a run on a disabled REQUIRED platform (LinkedIn), even when its result is a failure', () => {
    const outcome = evaluatePostOutcome({ ...OCT_20, linkedin: fail('LinkedIn timed out after 60s') });
    expect(outcome.ok).toBe(true);
    expect(outcome.failed).toEqual([]);
  });

  it('records a disabled X slot with the ruling as its error, in the existing result shape', () => {
    expect(disabledResult('twitter')).toEqual({
      success: false,
      error: 'X posting disabled (API credits depleted since 2026-08-28; Steve 2026-10-20)',
    });
  });

  it('does not warn about a disabled X slot', () => {
    const outcome = evaluatePostOutcome(OCT_20);
    expect(outcome.ok).toBe(true);
    expect(outcome.failed).toEqual([]);
    expect(outcome.warnings).toEqual([]);
  });

  it('leaves disabled platforms out of the success count and its denominator', () => {
    expect(countPlatforms(OCT_21)).toEqual({ succeeded: 2, total: 2 });
    expect(countPlatforms({ ...OCT_21, mastodon: fail('timed out') })).toEqual({ succeeded: 1, total: 2 });
  });

  it('names only active platforms for the startup banner', () => {
    expect(activePlatformNames()).toEqual(['Bluesky', 'Mastodon']);
  });
});

describe('evaluatePostOutcome', () => {
  it('treats an X/Twitter failure as a non-fatal warning when X is enabled again', () => {
    const outcome = evaluatePostOutcome(SEPT_5, ['threads']);
    expect(outcome.ok).toBe(true);
    expect(outcome.failed).toEqual([]);
    expect(outcome.warnings).toHaveLength(1);
    expect(outcome.warnings[0]).toMatch(/twitter/i);
    expect(outcome.warnings[0]).toMatch(/credits depleted/);
  });

  it('ignores Threads entirely (disabled by design, never a failure or a warning)', () => {
    const outcome = evaluatePostOutcome({ ...SEPT_5, twitter: OK });
    expect(outcome.ok).toBe(true);
    expect(outcome.failed).toEqual([]);
    expect(outcome.warnings).toEqual([]);
  });

  it('fails the slot when Bluesky fails, naming the platform and its error', () => {
    const outcome = evaluatePostOutcome({ ...SEPT_5, bluesky: fail('Auth failed: 401') });
    expect(outcome.ok).toBe(false);
    expect(outcome.failed).toHaveLength(1);
    expect(outcome.failed[0]).toMatch(/bluesky/i);
    expect(outcome.failed[0]).toMatch(/Auth failed: 401/);
  });

  it('fails the slot when Mastodon fails', () => {
    const outcome = evaluatePostOutcome({ ...SEPT_5, mastodon: fail('Post failed: 500') });
    expect(outcome.ok).toBe(false);
    expect(outcome.failed[0]).toMatch(/mastodon/i);
  });

  it('fails the slot when LinkedIn fails while LinkedIn is switched on (an expired session needs a human)', () => {
    const outcome = evaluatePostOutcome({ ...SEPT_5, linkedin: fail('LinkedIn timed out after 60s') }, ['threads', 'twitter']);
    expect(outcome.ok).toBe(false);
    expect(outcome.failed[0]).toMatch(/linkedin/i);
    expect(outcome.failed[0]).toMatch(/timed out/);
  });

  it('treats a missing required platform result as a failure (fail closed)', () => {
    const { linkedin: _omit, ...withoutLinkedIn } = SEPT_5;
    void _omit;
    const outcome = evaluatePostOutcome(withoutLinkedIn as SlotPlatformResults, ['threads', 'twitter']);
    expect(outcome.ok).toBe(false);
    expect(outcome.failed[0]).toMatch(/linkedin/i);
  });

  it('treats a missing Mastodon result as a failure under the default (LinkedIn-off) policy', () => {
    const { mastodon: _omit, ...withoutMastodon } = OCT_21;
    void _omit;
    const outcome = evaluatePostOutcome(withoutMastodon as SlotPlatformResults);
    expect(outcome.ok).toBe(false);
    expect(outcome.failed[0]).toMatch(/mastodon/i);
  });
});

describe('finishRun', () => {
  it('returns exit code 0 and logs RUN OK when nothing failed', () => {
    const log = { log: vi.fn(), error: vi.fn() };
    expect(finishRun('scheduler', [], log)).toBe(0);
    expect(log.log).toHaveBeenCalledWith(expect.stringMatching(/\[scheduler\] RUN OK/));
    expect(log.error).not.toHaveBeenCalled();
  });

  it('returns a non-zero exit code and logs every failure reason when something failed', () => {
    const log = { log: vi.fn(), error: vi.fn() };
    const code = finishRun('scheduler', ['morning: Bluesky: Auth failed: 401', 'morning: LinkedIn: timed out'], log);
    expect(code).not.toBe(0);
    const logged = log.error.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toMatch(/\[scheduler\] RUN FAILED \(2\)/);
    expect(logged).toContain('Bluesky: Auth failed: 401');
    expect(logged).toContain('LinkedIn: timed out');
  });
});
