import { describe, it, expect } from 'vitest';
import { deflateRawSync } from 'zlib';
import {
  MIN_TITLE_LEN,
  DEFAULT_DAY_CAP,
  US_POLITICS_TITLE,
  unzipSingle,
  gkgWindowStamps,
  parseGkgLine,
  isUsPolitics,
  normUrl,
  buildDayArticles,
  type ParsedGkgRow,
} from '@/lib/ingestion/gdelt-archive';

/**
 * Build a GKG 2.1 tab-delimited line (27 columns) with the fields the parser
 * reads: col 3 = domain, col 4 = URL, col 25 = translation info, last = V2EXTRAS.
 * Mirrors the real archive rows probed during the build.
 */
function makeGkgLine(opts: {
  domain?: string;
  url?: string;
  title?: string | null;
  translated?: boolean;
}): string {
  const cols = new Array(27).fill('');
  cols[0] = '20260719000000-1';
  cols[1] = '20260719000000';
  cols[3] = opts.domain ?? 'example.com';
  cols[4] = opts.url ?? 'http://example.com/article';
  cols[25] = opts.translated ? 'srclc:fra;eng:...' : '';
  const extras =
    opts.title === null
      ? '<PAGE_LINKS>whatever</PAGE_LINKS>'
      : `<PAGE_PRECISEPUBTIMESTAMP>x</PAGE_PRECISEPUBTIMESTAMP><PAGE_TITLE>${opts.title ?? 'A Headline'}</PAGE_TITLE>`;
  cols[26] = extras;
  return cols.join('\t');
}

/** Wrap raw content in a minimal single-file ZIP (deflate, method 8). */
function makeZip(content: string, filename = 'x.gkg.csv'): Buffer {
  const raw = Buffer.from(content, 'utf8');
  const comp = deflateRawSync(raw);
  const name = Buffer.from(filename, 'ascii');
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4); // version
  header.writeUInt16LE(0, 6); // flags
  header.writeUInt16LE(8, 8); // method = deflate
  header.writeUInt16LE(0, 10); // time
  header.writeUInt16LE(0, 12); // date
  header.writeUInt32LE(0, 14); // crc (unchecked by our reader)
  header.writeUInt32LE(comp.length, 18); // compressed size
  header.writeUInt32LE(raw.length, 22); // uncompressed size
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(0, 28); // extra len
  return Buffer.concat([header, name, comp]);
}

/** Wrap raw content in a STORED (method 0, uncompressed) single-file ZIP. */
function makeStoredZip(content: string, filename = 'x.gkg.csv'): Buffer {
  const raw = Buffer.from(content, 'utf8');
  const name = Buffer.from(filename, 'ascii');
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(0, 8); // method = stored
  header.writeUInt32LE(raw.length, 18); // compressed size = raw
  header.writeUInt32LE(raw.length, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(0, 28);
  return Buffer.concat([header, name, raw]);
}

const row = (over: Partial<ParsedGkgRow> = {}): ParsedGkgRow => ({
  url: 'http://cnn.com/politics/story',
  title: 'Trump signs executive order on federal hiring',
  domain: 'cnn.com',
  translated: false,
  ...over,
});

describe('unzipSingle', () => {
  it('round-trips a deflate-compressed single-file zip', () => {
    const content = 'line one\nline two\nline three';
    expect(unzipSingle(makeZip(content))).toBe(content);
  });

  it('decodes a stored (uncompressed) entry', () => {
    const content = 'stored content here';
    expect(unzipSingle(makeStoredZip(content))).toBe(content);
  });

  it('throws on a buffer that is not a zip local header', () => {
    expect(() => unzipSingle(Buffer.from('not a zip at all'))).toThrow();
  });

  it('throws on a too-short buffer', () => {
    expect(() => unzipSingle(Buffer.from([0x50, 0x4b]))).toThrow();
  });

  it('handles a streamed entry with compSize 0 by slicing to the central directory', () => {
    // Build a deflate zip then zero out the compressed-size field to force the
    // data-descriptor path, appending a central-directory signature as the boundary.
    const content = 'streamed row\tfields';
    const z = makeZip(content);
    z.writeUInt32LE(0, 18); // compSize = 0 -> triggers the indexOf(central dir) branch
    const cd = Buffer.from([0x50, 0x4b, 0x01, 0x02, 0, 0, 0, 0]);
    expect(unzipSingle(Buffer.concat([z, cd]))).toBe(content);
  });
});

describe('gkgWindowStamps', () => {
  it('produces exactly 96 fifteen-minute windows', () => {
    expect(gkgWindowStamps('2026-07-19')).toHaveLength(96);
  });

  it('formats stamps as YYYYMMDDHHMMSS with the day date verbatim (no TZ shift)', () => {
    const stamps = gkgWindowStamps('2026-07-19');
    expect(stamps[0]).toBe('20260719000000');
    expect(stamps[1]).toBe('20260719001500');
    expect(stamps[4]).toBe('20260719010000');
    expect(stamps[95]).toBe('20260719234500');
  });

  it('does not shift the date across a month boundary (string-based, not Date-based)', () => {
    // Regression guard against the date-fns format() local-time bug that turned
    // 2026-07-19 into 20260718 on a UTC-7 machine.
    expect(gkgWindowStamps('2026-08-01')[0]).toBe('20260801000000');
    expect(gkgWindowStamps('2026-01-01')[0]).toBe('20260101000000');
  });
});

describe('parseGkgLine', () => {
  it('extracts url, title, domain, and translated=false from a normal row', () => {
    const r = parseGkgLine(
      makeGkgLine({ domain: 'cnn.com', url: 'http://cnn.com/x', title: 'A Real Headline Here' }),
    );
    expect(r).toEqual({
      url: 'http://cnn.com/x',
      title: 'A Real Headline Here',
      domain: 'cnn.com',
      translated: false,
    });
  });

  it('returns null when the URL column is empty or non-http', () => {
    expect(parseGkgLine(makeGkgLine({ url: '' }))).toBeNull();
    expect(parseGkgLine(makeGkgLine({ url: 'ftp://x.com/a' }))).toBeNull();
  });

  it('returns an empty title when no PAGE_TITLE tag is present', () => {
    const r = parseGkgLine(makeGkgLine({ title: null }));
    expect(r?.title).toBe('');
  });

  it('strips a leading www. from the domain column', () => {
    const r = parseGkgLine(makeGkgLine({ domain: 'www.nytimes.com' }));
    expect(r?.domain).toBe('nytimes.com');
  });

  it('falls back to the URL hostname when the domain column is blank', () => {
    const r = parseGkgLine(makeGkgLine({ domain: '', url: 'http://www.washingtonpost.com/a' }));
    expect(r?.domain).toBe('washingtonpost.com');
  });

  it('flags a machine-translated (non-English) row', () => {
    const r = parseGkgLine(makeGkgLine({ translated: true }));
    expect(r?.translated).toBe(true);
  });

  it('returns null on an empty line', () => {
    expect(parseGkgLine('')).toBeNull();
  });
});

describe('isUsPolitics', () => {
  it('accepts an English, titled, keyword-matching, US-domain row', () => {
    expect(isUsPolitics(row())).toBe(true);
  });

  it('rejects a machine-translated row', () => {
    expect(isUsPolitics(row({ translated: true }))).toBe(false);
  });

  it('rejects a title shorter than the dedup minimum', () => {
    expect(isUsPolitics(row({ title: 'Trump' }))).toBe(false);
    expect('Trump'.length).toBeLessThan(MIN_TITLE_LEN);
  });

  it('rejects a title with no US-politics keyword', () => {
    expect(isUsPolitics(row({ title: 'Local weather forecast for the weekend ahead' }))).toBe(false);
  });

  it('rejects foreign ccTLD domains even when English and on-topic', () => {
    expect(
      isUsPolitics(row({ url: 'http://timesofindia.indiatimes.com/trump-congress-story' })),
    ).toBe(false);
    expect(isUsPolitics(row({ url: 'http://bbc.co.uk/news/trump-senate' }))).toBe(false);
  });

  it('accepts .com/.gov/.org US outlets', () => {
    expect(isUsPolitics(row({ url: 'http://whitehouse.gov/briefing-congress' }))).toBe(true);
    expect(isUsPolitics(row({ url: 'http://npr.org/trump-executive-order' }))).toBe(true);
  });

  it('matches each core query keyword', () => {
    for (const t of [
      'Trump holds a rally in Ohio tonight',
      'New executive order signed at the white house',
      'The DOJ opens a new inquiry into the matter',
      'Congress debates the spending bill for hours',
      'Supreme court hears arguments on the case',
      'The administration announces a policy shift',
    ]) {
      expect(US_POLITICS_TITLE.test(t)).toBe(true);
    }
  });
});

describe('normUrl', () => {
  it('strips query strings', () => {
    expect(normUrl('http://x.com/a?utm=1&b=2')).toBe('http://x.com/a');
  });

  it('strips a trailing slash and lowercases', () => {
    expect(normUrl('http://X.com/Path/')).toBe('http://x.com/path');
  });

  it('treats query and trailing-slash variants of one URL as equal', () => {
    expect(normUrl('http://x.com/a/?ref=twitter')).toBe(normUrl('http://x.com/a'));
  });
});

describe('buildDayArticles', () => {
  it('keeps only US-politics rows and stamps the requested day key', () => {
    const rows = [
      row({ url: 'http://cnn.com/1', title: 'Trump signs an executive order today' }),
      row({ url: 'http://timesofindia.indiatimes.com/2', title: 'Trump and congress talks' }), // foreign
      row({ url: 'http://x.com/3', title: 'A cat video goes viral online' }), // off-topic
      row({ url: 'http://npr.org/4', title: 'Senate votes on the federal budget' }),
    ];
    const out = buildDayArticles(rows, '2026-07-20');
    expect(out.map((a) => a.url)).toEqual(['http://cnn.com/1', 'http://npr.org/4']);
    expect(out.every((a) => a.date === '2026-07-20')).toBe(true);
  });

  it('dedups by normalized URL, keeping the first (newest-window) occurrence', () => {
    const rows = [
      row({ url: 'http://cnn.com/story?ref=a', title: 'Trump signs executive order now' }),
      row({ url: 'http://cnn.com/story/', title: 'Trump signs executive order now' }),
    ];
    const out = buildDayArticles(rows, '2026-07-20');
    expect(out).toHaveLength(1);
    expect(out[0].url).toBe('http://cnn.com/story?ref=a');
  });

  it('caps the result at the requested volume, preserving input (newest-first) order', () => {
    const rows = Array.from({ length: 500 }, (_, i) =>
      row({ url: `http://cnn.com/story-${i}`, title: `Trump news item number ${i} today` }),
    );
    const out = buildDayArticles(rows, '2026-07-20', 250);
    expect(out).toHaveLength(250);
    expect(out[0].url).toBe('http://cnn.com/story-0');
    expect(out[249].url).toBe('http://cnn.com/story-249');
  });

  it('defaults the cap to the DOC-comparable DEFAULT_DAY_CAP', () => {
    const rows = Array.from({ length: DEFAULT_DAY_CAP + 50 }, (_, i) =>
      row({ url: `http://cnn.com/s-${i}`, title: `Congress acts on measure number ${i}` }),
    );
    expect(buildDayArticles(rows, '2026-07-20')).toHaveLength(DEFAULT_DAY_CAP);
  });

  it('derives the domain from the URL hostname, www-stripped', () => {
    const out = buildDayArticles(
      [row({ url: 'http://www.politico.com/x', title: 'White house briefing on congress' })],
      '2026-07-20',
    );
    expect(out[0].domain).toBe('politico.com');
  });

  it('returns an empty array when nothing qualifies', () => {
    expect(buildDayArticles([row({ title: 'A short one' })], '2026-07-20')).toEqual([]);
  });
});
