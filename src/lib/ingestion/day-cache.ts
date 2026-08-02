/**
 * Resumable day-fetch cache for the historical backfill.
 *
 * WHY THIS EXISTS
 * GDELT's DOC API applies a multi-hour burst cooldown (429 with ~11s latency)
 * after a few dozen requests. The backfill needs 7 daily windows per week, and
 * the thin-week guard refuses to freeze a week under 5/7 days — correctly, because
 * a frozen week is permanent and un-refreshable. Before this cache, every run
 * started from zero and DISCARDED all successfully-fetched days when the guard
 * refused. Week 2026-07-19 hit 4/7 three times: 6 of its 7 days had each fetched
 * fine at least once, just never inside the same run.
 *
 * This module persists each confidently-fetched day so re-runs, separated by the
 * cooldown, only request the days still missing and accumulate toward the guard
 * at FULL GDELT volume — preserving comparability with every other frozen week
 * (all built from GDELT by the same method). It deliberately does NOT introduce a
 * lower-volume substitute source: GNews' historical range call yields ~20 articles
 * per week against GDELT's ~1,200, and a week thin enough to need it must refuse
 * rather than freeze a distorted snapshot into the permanent time series.
 *
 * SAFETY INVARIANTS
 * - Day keys are UTC. GDELT's `seendate` is UTC; date-fns `format()` renders local
 *   time, so a US-offset machine would key a window it never fetched.
 * - A day is cached only on a CONFIDENT success: HTTP 200 AND at least
 *   `minArticles` records. A throttled or truncated 200 returning a handful of
 *   rows is otherwise indistinguishable from a genuinely quiet news day, and
 *   caching it would bake permanent under-coverage.
 * - The cache stores metadata (status, count, fetched_at, query_version), never a
 *   bare "done" boolean, so a stale or degraded entry is auditable.
 * - `query_version` invalidates the whole file when the GDELT query changes;
 *   otherwise a cache built from a different query would silently mix methods
 *   within one week.
 */

import * as fs from 'fs';
import * as path from 'path';

/** Bump when the GDELT query string or article shape changes — invalidates caches. */
export const QUERY_VERSION = 'gdelt-doc-v1';

/**
 * Per-day article floor for a "confident" fetch. GDELT returns up to 250/day
 * (maxrecords cap) and observed real days land well above this; a throttled or
 * truncated response falls below it. Low enough not to reject a genuinely
 * quiet day, high enough that partial responses never look complete.
 */
export const MIN_CONFIDENT_ARTICLES = 40;

/** The article shape the backfill works in (distinct from ingestion `ArticleInput`). */
export interface CachedArticle {
  url: string;
  title: string;
  date: string;
  domain: string;
}

/** One day's fetch attempt, with enough metadata to audit it later. */
export interface DayFetch {
  /** UTC yyyy-MM-dd — the window actually queried. */
  date: string;
  /** Which upstream produced this (only 'gdelt' today; recorded so a future source is never mislabelled). */
  source: string;
  query_version: string;
  http_status: number;
  count: number;
  fetched_at: string;
  articles: CachedArticle[];
}

export interface WeekCache {
  week_id: string;
  query_version: string;
  days: Record<string, DayFetch>;
}

/** UTC day key. Never use date-fns format() for this — it renders local time. */
export function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The 7 UTC day keys of a week, given its Sunday start. */
export function weekDayKeys(weekStart: Date, days = 7): string[] {
  const base = Date.UTC(
    weekStart.getUTCFullYear(),
    weekStart.getUTCMonth(),
    weekStart.getUTCDate(),
  );
  return Array.from({ length: days }, (_, i) =>
    new Date(base + i * 86400000).toISOString().slice(0, 10),
  );
}

export function emptyCache(weekId: string): WeekCache {
  return { week_id: weekId, query_version: QUERY_VERSION, days: {} };
}

/**
 * A day counts toward the freeze guard only if the fetch was unambiguously good.
 * `articles.length === count` catches a truncated or hand-edited cache file.
 */
export function isConfident(
  day: DayFetch | undefined,
  minArticles = MIN_CONFIDENT_ARTICLES,
): boolean {
  if (!day) return false;
  if (day.query_version !== QUERY_VERSION) return false;
  if (day.http_status !== 200) return false;
  if (day.count < minArticles) return false;
  return day.articles.length === day.count;
}

export interface Coverage {
  /** Days good enough to count toward the guard. */
  usable: string[];
  /** Days with no cache entry at all — what a re-run should request. */
  missing: string[];
  /** Days present but not confident (throttled/thin/stale) — re-requested too. */
  weak: string[];
  /** Days needed to freeze: ceil(expected * 5/7). */
  required: number;
  canFreeze: boolean;
}

/**
 * Coverage is measured in days of the SAME source fetched the SAME way, each
 * meeting the volume floor. Counting days from sources with 50x different
 * volumes against one threshold would make the guard meaningless.
 */
export function coverage(
  cache: WeekCache,
  expectedDays: string[],
  minArticles = MIN_CONFIDENT_ARTICLES,
): Coverage {
  const usable: string[] = [];
  const missing: string[] = [];
  const weak: string[] = [];

  for (const key of expectedDays) {
    const day = cache.days[key];
    if (!day) missing.push(key);
    else if (isConfident(day, minArticles)) usable.push(key);
    else weak.push(key);
  }

  const required = Math.ceil((expectedDays.length * 5) / 7);
  return { usable, missing, weak, required, canFreeze: usable.length >= required };
}

/** Days a re-run still needs to request (missing + not-confident). */
export function daysToFetch(cov: Coverage): string[] {
  return [...cov.missing, ...cov.weak].sort();
}

/** Articles from confident days only, in day order. Weak days never reach the DB. */
export function usableArticles(
  cache: WeekCache,
  expectedDays: string[],
  minArticles = MIN_CONFIDENT_ARTICLES,
): CachedArticle[] {
  const out: CachedArticle[] = [];
  for (const key of expectedDays) {
    const day = cache.days[key];
    if (isConfident(day, minArticles)) out.push(...day!.articles);
  }
  return out;
}

/** Record a fetch attempt. Non-confident attempts are intentionally NOT stored. */
export function recordDay(
  cache: WeekCache,
  day: Omit<DayFetch, 'query_version'>,
  minArticles = MIN_CONFIDENT_ARTICLES,
): { cache: WeekCache; cached: boolean } {
  const entry: DayFetch = { ...day, query_version: QUERY_VERSION };
  if (!isConfident(entry, minArticles)) return { cache, cached: false };
  return {
    cache: { ...cache, days: { ...cache.days, [day.date]: entry } },
    cached: true,
  };
}

export function cachePath(dir: string, weekId: string): string {
  return path.join(dir, `${weekId}.json`);
}

/**
 * Load a week's cache. Any unreadable, malformed, or version-mismatched file
 * yields an empty cache — a corrupt cache must cause a re-fetch, never a
 * false "already covered".
 */
export function loadWeekCache(dir: string, weekId: string): WeekCache {
  const file = cachePath(dir, weekId);
  if (!fs.existsSync(file)) return emptyCache(weekId);
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as WeekCache;
    if (parsed.query_version !== QUERY_VERSION) return emptyCache(weekId);
    if (parsed.week_id !== weekId) return emptyCache(weekId);
    if (!parsed.days || typeof parsed.days !== 'object') return emptyCache(weekId);
    return parsed;
  } catch {
    return emptyCache(weekId);
  }
}

export function saveWeekCache(dir: string, cache: WeekCache): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(cachePath(dir, cache.week_id), JSON.stringify(cache, null, 2));
}
