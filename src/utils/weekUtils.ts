/**
 * Week utilities for store rotation timing.
 * Week starts on Monday 00:00 UTC.
 */

/**
 * Get the ISO week number for a date.
 * ISO weeks start on Monday.
 */
export function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Set to nearest Thursday (current date + 4 - current day number, making Sunday 7)
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  // Get first day of year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  // Calculate full weeks to nearest Thursday
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}

/**
 * Get the ISO week year for a date.
 * This may differ from the calendar year at year boundaries.
 */
export function getISOWeekYear(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  return d.getUTCFullYear();
}

/**
 * Generate a week key in format "YYYY-WW".
 * Example: "2025-03" for the 3rd week of 2025.
 */
export function getWeekKey(date: Date = new Date()): string {
  const year = getISOWeekYear(date);
  const week = getISOWeekNumber(date);
  return `${year}-${String(week).padStart(2, '0')}`;
}

/**
 * Get the start of the current ISO week (Monday 00:00 UTC).
 */
export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  // Adjust to Monday (day 0 = Sunday, so we need to go back 6 days; day 1 = Monday, go back 0 days)
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

/**
 * Get the start of the next ISO week (next Monday 00:00 UTC).
 */
export function getNextWeekStart(date: Date = new Date()): Date {
  const weekStart = getWeekStart(date);
  weekStart.setUTCDate(weekStart.getUTCDate() + 7);
  return weekStart;
}

/**
 * Get the Unix timestamp (milliseconds) for the next store refresh.
 * Store refreshes every Monday at 00:00 UTC.
 */
export function getNextRefreshTimestamp(date: Date = new Date()): number {
  return getNextWeekStart(date).getTime();
}
