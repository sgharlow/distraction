// ═══════════════════════════════════════════════════════════════
// Week Utilities — Sunday-start calendar weeks from Jan 2025
// All dates handled in ET (Eastern Time) per spec
// ═══════════════════════════════════════════════════════════════

import { format, addDays as dfAddDays, differenceInCalendarWeeks, startOfDay, isBefore, isAfter, isSameDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const ET_TIMEZONE = 'America/New_York';

// First available week contains January 1, 2025 → starts Sun Dec 29, 2024
export const FIRST_WEEK_START = new Date('2024-12-29T00:00:00');

/**
 * Get the Sunday that starts the week containing the given date.
 */
export function getWeekStart(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - day);
  return d;
}

/**
 * Get the current week's start date in ET.
 */
export function getCurrentWeekStart(): Date {
  const nowET = toZonedTime(new Date(), ET_TIMEZONE);
  return getWeekStart(nowET);
}

/**
 * Get the Saturday that ends the week starting on the given Sunday.
 */
export function getWeekEnd(weekStart: Date): Date {
  return dfAddDays(weekStart, 6);
}

/**
 * Generate a week_id string like "2026-02-02" from a week start date.
 * We use the ISO date of the Sunday as the week identifier.
 */
export function toWeekId(weekStart: Date): string {
  return format(weekStart, 'yyyy-MM-dd');
}

/**
 * Parse a week_id string back to a Date.
 */
export function parseWeekId(weekId: string): Date {
  // weekId is "YYYY-MM-DD" representing the Sunday
  const [year, month, day] = weekId.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Get a human-readable week label like "Feb 2 – Feb 8, 2026"
 */
export function getWeekLabel(weekStart: Date): string {
  const end = getWeekEnd(weekStart);
  const startStr = format(weekStart, 'MMM d');
  const endStr = format(end, 'MMM d, yyyy');
  return `${startStr} – ${endStr}`;
}

/**
 * Get a short label like "Feb 2 – 8"
 */
export function getWeekLabelShort(weekStart: Date): string {
  const end = getWeekEnd(weekStart);
  if (weekStart.getMonth() === end.getMonth()) {
    return `${format(weekStart, 'MMM d')} – ${format(end, 'd')}`;
  }
  return `${format(weekStart, 'MMM d')} – ${format(end, 'MMM d')}`;
}

/**
 * Get the week number (1-based from FIRST_WEEK_START).
 */
export function getWeekNumber(weekStart: Date): number {
  const diffMs = weekStart.getTime() - FIRST_WEEK_START.getTime();
  return Math.round(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
}

/**
 * Check if the given week start date is the current live week.
 */
export function isCurrentWeek(weekStart: Date): boolean {
  const current = getCurrentWeekStart();
  return isSameDay(weekStart, current);
}

/**
 * Check if the given week is in the future (hasn't started yet).
 */
export function isFutureWeek(weekStart: Date): boolean {
  return isAfter(weekStart, getCurrentWeekStart());
}

/**
 * Check if the given week is in the past (should be frozen).
 */
export function isPastWeek(weekStart: Date): boolean {
  return isBefore(weekStart, getCurrentWeekStart());
}

/**
 * Get all week start dates from FIRST_WEEK_START to current week.
 * Returns newest first.
 */
export function getAllWeekStarts(): Date[] {
  const current = getCurrentWeekStart();
  const weeks: Date[] = [];
  let d = new Date(FIRST_WEEK_START);
  while (!isAfter(d, current)) {
    weeks.push(new Date(d));
    d = dfAddDays(d, 7);
  }
  return weeks.reverse();
}

/**
 * Resolve the "current" keyword or a date string to a week start date.
 * Used for URL parameter parsing.
 */
export function resolveWeekParam(param: string): Date | null {
  if (param === 'current') {
    return getCurrentWeekStart();
  }
  // Try parsing as YYYY-MM-DD
  const parsed = parseWeekId(param);
  if (isNaN(parsed.getTime())) return null;

  // Snap to the week's Sunday
  const weekStart = getWeekStart(parsed);

  // Validate range
  if (isBefore(weekStart, FIRST_WEEK_START)) return null;
  if (isFutureWeek(weekStart)) return null;

  return weekStart;
}

/**
 * Get the week_id for a given event date (assigns it to the correct week).
 */
export function getWeekIdForDate(eventDate: Date): string {
  return toWeekId(getWeekStart(eventDate));
}
