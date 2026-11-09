/**
 * Calendar arithmetic on ISO dates ("2026-11-09"). Date cells have no time
 * zone, so every step runs in UTC: a day never shifts with the viewer's clock.
 */

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** "2026-11" for the month the given day falls in. */
export function monthOf(isoDay: string): string {
  return isoDay.slice(0, 7);
}

/** Today as an ISO day, in the viewer's own calendar. */
export function todayIso(now = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** A valid "YYYY-MM", or null. */
export function parseMonth(raw: string | null): string | null {
  return raw && MONTH_PATTERN.test(raw) ? raw : null;
}

function utcDate(isoDay: string): Date {
  return new Date(`${isoDay}T00:00:00Z`);
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(isoDay: string, days: number): string {
  const date = utcDate(isoDay);
  date.setUTCDate(date.getUTCDate() + days);
  return iso(date);
}

export function addMonths(month: string, months: number): string {
  const date = utcDate(`${month}-01`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return monthOf(iso(date));
}

/**
 * The days a month grid shows: whole weeks from Monday to Sunday, so the
 * first and last rows include days of the months around it.
 */
export function monthGrid(month: string): string[] {
  const first = `${month}-01`;
  // getUTCDay: 0 is Sunday; weeks here start on Monday.
  const start = addDays(first, -((utcDate(first).getUTCDay() + 6) % 7));
  const last = addDays(`${addMonths(month, 1)}-01`, -1);
  const end = addDays(last, (7 - utcDate(last).getUTCDay()) % 7);
  const days: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) {
    days.push(day);
  }
  return days;
}

/** Short weekday names from Monday, in the given language. */
export function weekdayNames(locale: string, width: "short" | "long" = "short"): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: width, timeZone: "UTC" });
  // 2024-01-01 was a Monday.
  return Array.from({ length: 7 }, (_, index) => format.format(utcDate(addDays("2024-01-01", index))));
}

export function formatMonth(month: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    utcDate(`${month}-01`),
  );
}

export function formatDay(isoDay: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(utcDate(isoDay));
}

/** The day of the month, as a number. */
export function dayNumber(isoDay: string): number {
  return Number(isoDay.slice(8, 10));
}
