import { describe, it, expect } from 'vitest';
import { mkdtempSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { captureFailure, type CapturePage } from '../../scripts/outreach/substack-verify';

const NOW = new Date('2026-10-18T09:06:11Z');
const EDITOR_URL = 'https://distractionindex.substack.com/publish/post/220963103';

/** A fake Playwright page for the failure capture; dialogs/screenshot can be made to throw. */
function fakePage(opts: { dialogs?: string[] | Error; screenshot?: Error } = {}) {
  const shots: string[] = [];
  const page: CapturePage = {
    url: () => EDITOR_URL,
    screenshot: async ({ path }) => {
      if (opts.screenshot) throw opts.screenshot;
      shots.push(path);
      return Buffer.from('');
    },
    locator: () => ({
      allInnerTexts: async () => {
        if (opts.dialogs instanceof Error) throw opts.dialogs;
        return opts.dialogs ?? [];
      },
    }),
  };
  return { page, shots };
}

describe('captureFailure', () => {
  it('saves a screenshot named for the label and reports the url and any open dialog text', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'substack-capture-'));
    const { page, shots } = fakePage({ dialogs: ['Add subscribe buttons to your post?\nAdd subscribe buttons\nPublish without buttons'] });
    const lines = await captureFailure(page, 'not-published', dir, NOW);
    expect(shots).toEqual([join(dir, 'substack-not-published-2026-10-18T09-06-11Z.png')]);
    expect(lines.join('\n')).toContain(`url: ${EDITOR_URL}`);
    expect(lines.join('\n')).toContain('dialog: Add subscribe buttons to your post? | Add subscribe buttons | Publish without buttons');
    expect(lines.join('\n')).toContain(`screenshot: ${shots[0]}`);
  });

  it('creates the capture folder when it does not exist', async () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'substack-capture-')), 'nested', 'debug-screenshots');
    const { page } = fakePage();
    await captureFailure(page, 'x', dir, NOW);
    expect(existsSync(dir)).toBe(true);
  });

  it('says so when no dialog is open', async () => {
    const { page } = fakePage({ dialogs: [] });
    const lines = await captureFailure(page, 'x', mkdtempSync(join(tmpdir(), 'substack-capture-')), NOW);
    expect(lines).toContain('dialog: none open');
  });

  it('never throws: a failed screenshot or dialog read is reported, not raised (it must not mask the real failure)', async () => {
    const { page } = fakePage({ dialogs: new Error('Target closed'), screenshot: new Error('page crashed') });
    const lines = await captureFailure(page, 'x', mkdtempSync(join(tmpdir(), 'substack-capture-')), NOW);
    expect(lines.join('\n')).toContain('screenshot failed: page crashed');
    expect(lines.join('\n')).toContain('dialog read failed: Target closed');
    expect(lines.join('\n')).toContain(`url: ${EDITOR_URL}`);
  });
});
