// Date helpers. All "calendar dates" are YYYY-MM-DD strings in Jo's chosen timezone.

export const DEFAULT_TZ = "Australia/Melbourne";

export function isoDateInTz(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function hourInTz(d: Date, tz: string): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(d)) % 24;
}
const toUTC = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y!, m! - 1, d!); };
export function addDays(iso: string, n: number): string {
  return new Date(toUTC(iso) + n * 86400000).toISOString().slice(0, 10);
}
export function diffDays(a: string, b: string): number { return Math.round((toUTC(a) - toUTC(b)) / 86400000); }
/** 1 = Monday … 7 = Sunday */
export function isoWeekday(iso: string): number { const d = new Date(toUTC(iso)).getUTCDay(); return d === 0 ? 7 : d; }
export function mondayOf(iso: string): string { return addDays(iso, 1 - isoWeekday(iso)); }
export function weekIndexBetween(startMonday: string, iso: string): number { return Math.floor(diffDays(mondayOf(iso), startMonday) / 7); }

export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Australian format: 9 Nov 2026, or Monday 9 November */
export function formatDateAU(iso: string, style: "short" | "long" | "weekday" = "short"): string {
  const d = new Date(toUTC(iso));
  const opts: Intl.DateTimeFormatOptions =
    style === "short" ? { day: "numeric", month: "short", year: "numeric" }
    : style === "long" ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
    : { weekday: "long", day: "numeric", month: "long" };
  return new Intl.DateTimeFormat("en-AU", { ...opts, timeZone: "UTC" }).format(d);
}
export function isValidTimezone(tz: string): boolean {
  try { new Intl.DateTimeFormat("en-AU", { timeZone: tz }); return true; } catch { return false; }
}
export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
