import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * WHY (2026-10-11). The dev root moved from C:\Users\sghar\CascadeProjects to C:\source on
 * 2026-10-09. Three scheduled tasks kept `cd /d C:\Users\sghar\CascadeProjects\distraction`,
 * so the Sunday Substack publish failed and Week 93 was missed. The setup scripts that create
 * those tasks carried the same literal path, so re-running any of them would re-break the
 * tasks. They now derive the project folder from their own location instead.
 */
const OUTREACH = resolve(__dirname, '../../scripts/outreach');
const SETUP_FILES = readdirSync(OUTREACH).filter((f) => /\.(bat|ps1)$/i.test(f) || /^task-.*\.xml$/i.test(f));
const read = (f: string) => readFileSync(resolve(OUTREACH, f), 'utf8');

describe('task setup scripts carry no machine-specific project path', () => {
  it('finds the setup files (positive control: the scan is not empty)', () => {
    expect(SETUP_FILES).toEqual(expect.arrayContaining(['recreate-tasks.bat', 'setup-scheduler.bat', 'task-morning.xml']));
  });

  it.each(SETUP_FILES)('%s has no hard-coded user-profile or CascadeProjects path', (f) => {
    const text = read(f);
    expect(text).not.toMatch(/CascadeProjects/i);
    expect(text).not.toMatch(/C:\\Users\\/i);
  });

  it.each(SETUP_FILES.filter((f) => f.endsWith('.bat')))('%s derives the project folder from its own location', (f) => {
    expect(read(f)).toContain('%~dp0');
  });

  it.each(SETUP_FILES.filter((f) => f.endsWith('.ps1')))('%s derives the project folder from $PSScriptRoot', (f) => {
    expect(read(f)).toContain('$PSScriptRoot');
  });

  it.each(SETUP_FILES.filter((f) => f.endsWith('.xml')))('%s uses the __PROJECT_DIR__ placeholder', (f) => {
    expect(read(f)).toContain('__PROJECT_DIR__');
  });

  it('setup-scheduler.bat fills __PROJECT_DIR__ before importing the XML (never imports the raw template)', () => {
    const text = read('setup-scheduler.bat');
    expect(text).toContain('__PROJECT_DIR__');
    expect(text).not.toMatch(/\/xml "%SCRIPT_DIR%task-/);
  });
});

/**
 * WHY (2026-10-13). DistractionIndex-EmailFollowups was retired: its contact list
 * (outreach-contacts.csv, gitignored) exists nowhere, so every run failed (last 10-05,
 * result 1). The task was unregistered with an XML backup kept outside the repo. A setup
 * script that still creates it would quietly bring it back, so none may.
 */
describe('retired task DistractionIndex-EmailFollowups is never re-created', () => {
  const CREATES_EMAIL_FOLLOWUPS = [
    /schtasks\s+\/create\b[^\n]*DistractionIndex-EmailFollowups/i,
    /Register-ScheduledTask\b[^\n]*DistractionIndex-EmailFollowups/i,
    /Name\s*=\s*["']DistractionIndex-EmailFollowups["']/i,
  ];

  it('the patterns catch a create line (positive control)', () => {
    const planted = 'schtasks /create /tn "DistractionIndex-EmailFollowups" /tr "cmd /c x" /sc weekly';
    expect(CREATES_EMAIL_FOLLOWUPS.some((p) => p.test(planted))).toBe(true);
  });

  it.each(SETUP_FILES)('%s does not create DistractionIndex-EmailFollowups', (f) => {
    const text = read(f);
    for (const p of CREATES_EMAIL_FOLLOWUPS) expect(text).not.toMatch(p);
  });
});
