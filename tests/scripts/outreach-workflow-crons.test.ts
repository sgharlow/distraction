import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// The outreach workflows' schedules. GitHub passes the cron string itself as github.event.schedule,
// and outreach-post.yml's "Pick the slot" step maps it to a slot with an exact `case` match, so a
// cron edited in one place and not the other fails every scheduled run ("unknown schedule").
// Hosted cron also ran 3h05m / 4h38m / 3h58m late on 2026-10-21/22 at :00/:30, the minutes GitHub
// says are busiest, so no schedule may sit on either (local-task-elimination-plan-2026-10-20.md).
const POST = readFileSync('.github/workflows/outreach-post.yml', 'utf8');
const DEADMAN = readFileSync('.github/workflows/outreach-deadman.yml', 'utf8');

const crons = (yml: string) => [...yml.matchAll(/^\s*- cron: '([^']+)'/gm)].map((m) => m[1]);
const caseArms = (yml: string) =>
  [...yml.matchAll(/^\s*'([^']+)'\)\s*job=(\w+)\s*;;/gm)].map((m) => ({ cron: m[1], job: m[2] }));
const minute = (cron: string) => Number(cron.split(/\s+/)[0]);

describe('outreach workflow schedules', () => {
  it('every scheduled cron in outreach-post.yml has a slot arm, and every arm a cron', () => {
    const scheduled = crons(POST).sort();
    const arms = caseArms(POST).map((a) => a.cron).sort();
    expect(scheduled.length).toBe(3);
    expect(arms).toEqual(scheduled);
  });

  it('the arms still name the three slots', () => {
    expect(caseArms(POST).map((a) => a.job).sort()).toEqual(['midday', 'morning', 'thread']);
  });

  it('no schedule sits on :00 or :30, the busiest hosted-cron minutes', () => {
    for (const c of [...crons(POST), ...crons(DEADMAN)]) {
      expect([0, 30], c).not.toContain(minute(c));
    }
  });

  it('the dead-man still runs after the morning slot', () => {
    const [deadman] = crons(DEADMAN);
    const morning = caseArms(POST).find((a) => a.job === 'morning')!.cron;
    const at = (c: string) => Number(c.split(/\s+/)[1]) * 60 + minute(c);
    expect(at(deadman)).toBeGreaterThan(at(morning));
  });
});
