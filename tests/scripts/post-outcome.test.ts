import { describe, it, expect, vi } from 'vitest';
import {
  evaluatePostOutcome,
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

describe('evaluatePostOutcome', () => {
  it('treats an X/Twitter failure as a non-fatal warning (credits depleted is not a failed run)', () => {
    const outcome = evaluatePostOutcome(SEPT_5);
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

  it('fails the slot when LinkedIn fails (an expired session needs a human, so it must be loud)', () => {
    const outcome = evaluatePostOutcome({ ...SEPT_5, linkedin: fail('LinkedIn timed out after 60s') });
    expect(outcome.ok).toBe(false);
    expect(outcome.failed[0]).toMatch(/linkedin/i);
    expect(outcome.failed[0]).toMatch(/timed out/);
  });

  it('treats a missing required platform result as a failure (fail closed)', () => {
    const { linkedin: _omit, ...withoutLinkedIn } = SEPT_5;
    void _omit;
    const outcome = evaluatePostOutcome(withoutLinkedIn as SlotPlatformResults);
    expect(outcome.ok).toBe(false);
    expect(outcome.failed[0]).toMatch(/linkedin/i);
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
