import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  QUERY_VERSION,
  MIN_CONFIDENT_ARTICLES,
  utcDayKey,
  weekDayKeys,
  emptyCache,
  isConfident,
  coverage,
  daysToFetch,
  usableArticles,
  recordDay,
  loadWeekCache,
  saveWeekCache,
  cachePath,
  type DayFetch,
  type CachedArticle,
} from '@/lib/ingestion/day-cache';

const arts = (n: number, tag = 'a'): CachedArticle[] =>
  Array.from({ length: n }, (_, i) => ({
    url: `https://example.com/${tag}/${i}`,
    title: `Headline number ${i} about the administration`,
    date: '2026-07-19',
    domain: 'example.com',
  }));

const goodDay = (date: string, count = 120): Omit<DayFetch, 'query_version'> => ({
  date,
  source: 'gdelt',
  http_status: 200,
  count,
  fetched_at: '2026-07-31T12:00:00Z',
  articles: arts(count, date),
});

const WEEK = '2026-07-19';
const KEYS = weekDayKeys(new Date('2026-07-19'));

describe('utcDayKey / weekDayKeys — timezone safety', () => {
  it('keys the UTC day, not the local day', () => {
    // Regression: date-fns format(new Date('2026-07-19'),'yyyyMMdd') returns
    // 20260718 on a UTC-7 machine. A cache keyed that way names a window that
    // was never fetched.
    expect(utcDayKey(new Date('2026-07-19'))).toBe('2026-07-19');
    expect(utcDayKey(new Date('2026-07-19T00:00:00Z'))).toBe('2026-07-19');
  });

  it('returns the 7 consecutive UTC days of the week', () => {
    expect(KEYS).toEqual([
      '2026-07-19', '2026-07-20', '2026-07-21', '2026-07-22',
      '2026-07-23', '2026-07-24', '2026-07-25',
    ]);
  });

  it('crosses a month boundary without drift', () => {
    expect(weekDayKeys(new Date('2026-07-26'))).toEqual([
      '2026-07-26', '2026-07-27', '2026-07-28', '2026-07-29',
      '2026-07-30', '2026-07-31', '2026-08-01',
    ]);
  });

  it('crosses a DST boundary without repeating or skipping a day', () => {
    // US DST ends 2026-11-01; a local-time implementation drifts here.
    expect(weekDayKeys(new Date('2026-11-01'))).toEqual([
      '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04',
      '2026-11-05', '2026-11-06', '2026-11-07',
    ]);
  });

  it('honours an explicit day count for a short (current) week', () => {
    expect(weekDayKeys(new Date('2026-07-19'), 3)).toEqual([
      '2026-07-19', '2026-07-20', '2026-07-21',
    ]);
  });
});

describe('isConfident', () => {
  it('accepts a 200 with volume at or above the floor', () => {
    expect(isConfident({ ...goodDay('2026-07-19'), query_version: QUERY_VERSION })).toBe(true);
  });

  it('rejects undefined (never fetched)', () => {
    expect(isConfident(undefined)).toBe(false);
  });

  it('rejects a thin 200 — a throttled response must not look like a quiet day', () => {
    const thin = { ...goodDay('2026-07-19', 3), query_version: QUERY_VERSION };
    expect(isConfident(thin)).toBe(false);
  });

  it('rejects a non-200 status', () => {
    const err = { ...goodDay('2026-07-19'), http_status: 429, query_version: QUERY_VERSION };
    expect(isConfident(err)).toBe(false);
  });

  it('rejects a stale query_version', () => {
    const stale = { ...goodDay('2026-07-19'), query_version: 'gdelt-doc-v0' };
    expect(isConfident(stale)).toBe(false);
  });

  it('rejects a truncated cache entry (count disagrees with articles)', () => {
    const bad = { ...goodDay('2026-07-19', 120), query_version: QUERY_VERSION, articles: arts(5) };
    expect(isConfident(bad)).toBe(false);
  });

  it('accepts exactly at the floor and rejects one below', () => {
    const at = { ...goodDay('2026-07-19', MIN_CONFIDENT_ARTICLES), query_version: QUERY_VERSION };
    const below = { ...goodDay('2026-07-19', MIN_CONFIDENT_ARTICLES - 1), query_version: QUERY_VERSION };
    expect(isConfident(at)).toBe(true);
    expect(isConfident(below)).toBe(false);
  });
});

describe('coverage / canFreeze', () => {
  const build = (dates: string[], count = 120) =>
    dates.reduce((c, d) => recordDay(c, goodDay(d, count)).cache, emptyCache(WEEK));

  it('requires 5 of 7 days', () => {
    expect(coverage(emptyCache(WEEK), KEYS).required).toBe(5);
  });

  it('refuses to freeze at 4/7 — the observed 2026-07-19 case', () => {
    const cov = coverage(build(KEYS.slice(0, 4)), KEYS);
    expect(cov.usable).toHaveLength(4);
    expect(cov.canFreeze).toBe(false);
    expect(cov.missing).toHaveLength(3);
  });

  it('allows freezing at 5/7', () => {
    const cov = coverage(build(KEYS.slice(0, 5)), KEYS);
    expect(cov.usable).toHaveLength(5);
    expect(cov.canFreeze).toBe(true);
  });

  it('accumulates across runs — the whole point of the cache', () => {
    // Run 1 got Sun-Wed. Run 2, after the cooldown, gets Thu.
    let cache = build(KEYS.slice(0, 4));
    expect(coverage(cache, KEYS).canFreeze).toBe(false);
    cache = recordDay(cache, goodDay(KEYS[4])).cache;
    expect(coverage(cache, KEYS).canFreeze).toBe(true);
  });

  it('does NOT count thin days toward the threshold', () => {
    // 5 days present, but 2 are throttled-thin: must still refuse.
    let cache = build(KEYS.slice(0, 3));
    cache = { ...cache, days: { ...cache.days,
      [KEYS[3]]: { ...goodDay(KEYS[3], 2), query_version: QUERY_VERSION },
      [KEYS[4]]: { ...goodDay(KEYS[4], 1), query_version: QUERY_VERSION },
    } };
    const cov = coverage(cache, KEYS);
    expect(cov.usable).toHaveLength(3);
    expect(cov.weak).toHaveLength(2);
    expect(cov.canFreeze).toBe(false);
  });

  it('lists weak and missing days as work for the next run', () => {
    let cache = build(KEYS.slice(0, 3));
    cache = { ...cache, days: { ...cache.days,
      [KEYS[3]]: { ...goodDay(KEYS[3], 2), query_version: QUERY_VERSION },
    } };
    expect(daysToFetch(coverage(cache, KEYS))).toEqual([
      KEYS[3], KEYS[4], KEYS[5], KEYS[6],
    ]);
  });
});

describe('recordDay', () => {
  it('does not cache a thin fetch', () => {
    const { cache, cached } = recordDay(emptyCache(WEEK), goodDay('2026-07-19', 4));
    expect(cached).toBe(false);
    expect(Object.keys(cache.days)).toHaveLength(0);
  });

  it('does not cache a 429', () => {
    const { cache, cached } = recordDay(emptyCache(WEEK), {
      ...goodDay('2026-07-19'), http_status: 429, count: 0, articles: [],
    });
    expect(cached).toBe(false);
    expect(Object.keys(cache.days)).toHaveLength(0);
  });

  it('stores auditable metadata, not a bare boolean', () => {
    const { cache } = recordDay(emptyCache(WEEK), goodDay('2026-07-19'));
    const day = cache.days['2026-07-19'];
    expect(day.source).toBe('gdelt');
    expect(day.http_status).toBe(200);
    expect(day.count).toBe(120);
    expect(day.fetched_at).toBe('2026-07-31T12:00:00Z');
    expect(day.query_version).toBe(QUERY_VERSION);
  });

  it('does not mutate the input cache', () => {
    const before = emptyCache(WEEK);
    recordDay(before, goodDay('2026-07-19'));
    expect(Object.keys(before.days)).toHaveLength(0);
  });
});

describe('usableArticles', () => {
  it('returns only confident days, in day order', () => {
    let cache = recordDay(emptyCache(WEEK), goodDay(KEYS[1], 50)).cache;
    cache = recordDay(cache, goodDay(KEYS[0], 60)).cache;
    const out = usableArticles(cache, KEYS);
    expect(out).toHaveLength(110);
    // KEYS[0] articles are tagged with their date, so order is checkable.
    expect(out[0].url).toContain(KEYS[0]);
    expect(out[out.length - 1].url).toContain(KEYS[1]);
  });

  it('excludes thin days from what reaches the database', () => {
    let cache = recordDay(emptyCache(WEEK), goodDay(KEYS[0], 60)).cache;
    cache = { ...cache, days: { ...cache.days,
      [KEYS[1]]: { ...goodDay(KEYS[1], 3), query_version: QUERY_VERSION },
    } };
    expect(usableArticles(cache, KEYS)).toHaveLength(60);
  });
});

describe('loadWeekCache / saveWeekCache — fail toward re-fetching', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'daycache-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('round-trips a cache', () => {
    const cache = recordDay(emptyCache(WEEK), goodDay(KEYS[0])).cache;
    saveWeekCache(dir, cache);
    const loaded = loadWeekCache(dir, WEEK);
    expect(coverage(loaded, KEYS).usable).toEqual([KEYS[0]]);
  });

  it('returns an empty cache when no file exists', () => {
    expect(Object.keys(loadWeekCache(dir, WEEK).days)).toHaveLength(0);
  });

  it('returns an empty cache on malformed JSON (never a false "covered")', () => {
    fs.writeFileSync(cachePath(dir, WEEK), '{ this is not json');
    expect(Object.keys(loadWeekCache(dir, WEEK).days)).toHaveLength(0);
  });

  it('discards a cache written by a different query version', () => {
    const cache = recordDay(emptyCache(WEEK), goodDay(KEYS[0])).cache;
    saveWeekCache(dir, { ...cache, query_version: 'gdelt-doc-v0' });
    expect(Object.keys(loadWeekCache(dir, WEEK).days)).toHaveLength(0);
  });

  it('discards a cache whose week_id does not match the requested week', () => {
    const cache = recordDay(emptyCache('2026-07-12'), goodDay(KEYS[0])).cache;
    fs.writeFileSync(cachePath(dir, WEEK), JSON.stringify(cache));
    expect(Object.keys(loadWeekCache(dir, WEEK).days)).toHaveLength(0);
  });

  it('creates the cache directory if absent', () => {
    const nested = path.join(dir, 'deep', 'deeper');
    saveWeekCache(nested, emptyCache(WEEK));
    expect(fs.existsSync(cachePath(nested, WEEK))).toBe(true);
  });
});
