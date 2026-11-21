import type { Country } from "./types";

export const DEMO_TODAY = "2026-11-19";
export const DEMO_NOW = "2026-11-19T13:05:00.000Z";
export const WINDOW_DAYS = 90;
export const SEED = 20261119;

export const COUNTRIES: Country[] = ["DE", "PL", "IT", "ES", "PT"];

export const TIMEZONE: Record<Country, string> = {
  DE: "Europe/Berlin",
  PL: "Europe/Warsaw",
  IT: "Europe/Rome",
  ES: "Europe/Madrid",
  PT: "Europe/Lisbon",
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export const WINDOW_START = addDays(DEMO_TODAY, -(WINDOW_DAYS - 1));
export const FORECAST_END = addDays(DEMO_TODAY, 7);
export const MAINTENANCE_START = addDays(DEMO_TODAY, -3);

export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function weekdayIndex(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function weekdayName(iso: string): string {
  return WEEKDAYS[weekdayIndex(iso)];
}

export function weekdayShort(iso: string): string {
  return WEEKDAYS_SHORT[weekdayIndex(iso)];
}

export function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatDayShort(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** EU DST ends 2026-10-25. Portugal is one hour behind Central Europe. */
export function offsetHours(country: Country, date: string): number {
  const summer = date < "2026-10-25";
  if (country === "PT") return summer ? 1 : 0;
  return summer ? 2 : 1;
}

export function slotIso(date: string, quarter: number, offsetH: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d, 0, quarter * 15, 0) - offsetH * 3_600_000;
  return new Date(utc).toISOString();
}

export function formatClock(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(new Date(iso));
}

export function formatStamp(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(new Date(iso));
}

export function zoneLabel(timeZone: string): string {
  if (timeZone === "Europe/Lisbon") return "WET/WEST";
  return "CET/CEST";
}

export const DELAY_FROM = "2026-11-19T13:15:00.000Z";

/** Offset of a time zone at a given instant, in milliseconds (local wall time minus UTC). */
function zoneOffsetMs(ts: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ts));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - ts;
}

/**
 * Reads a `datetime-local` value ("2026-11-23T09:00") as wall time in the asset's zone.
 * `new Date(value)` would use the browser's zone, which differs between server and client.
 */
export function zonedToIso(local: string, timeZone: string): string {
  const [date, time = "00:00"] = local.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  const first = guess - zoneOffsetMs(guess, timeZone);
  return new Date(guess - zoneOffsetMs(first, timeZone)).toISOString();
}
