import { shop } from "./config";
import type { Settings } from "./settings";

/** Dates are plain "YYYY-MM-DD" strings and times "HH:MM", always in the shop's time zone. */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isDateString(v: unknown): v is string {
  if (typeof v !== "string" || !DATE_RE.test(v)) return false;
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function isTimeString(v: unknown): v is string {
  return typeof v === "string" && TIME_RE.test(v);
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekday(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** Current date and minute-of-day in the shop's time zone, whatever the server's own zone is. */
export function shopNow(now: Date = new Date()): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: shop.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

/** Every slot the schedule offers on a date, ignoring bookings. */
export function scheduleSlots(date: string, s: Pick<Settings, "hours" | "slotMinutes">): string[] {
  const ranges = s.hours[weekday(date)] ?? [];
  const out: string[] = [];
  for (const [open, close] of ranges) {
    const end = toMinutes(close);
    for (let t = toMinutes(open); t + s.slotMinutes <= end; t += s.slotMinutes) {
      out.push(fromMinutes(t));
    }
  }
  return out;
}

/**
 * Whether an appointment sits entirely inside the opening hours of its day.
 * Independent of the slot grid, so a 10:45 booking still counts as "inside" after slots change to 60′.
 */
export function withinHours(date: string, time: string, minutes: number, s: Pick<Settings, "hours">): boolean {
  const start = toMinutes(time);
  return (s.hours[weekday(date)] ?? []).some(([open, close]) => start >= toMinutes(open) && start + minutes <= toMinutes(close));
}

/** Whether two time ranges on the same day overlap (start times as HH:MM, lengths in minutes). */
export function overlaps(aStart: string, aMinutes: number, bStart: string, bMinutes: number): boolean {
  const a = toMinutes(aStart);
  const b = toMinutes(bStart);
  return a < b + bMinutes && b < a + aMinutes;
}

/** Whether a slot start is still bookable by a customer right now. */
export function isFutureEnough(date: string, time: string, leadMinutes: number, now = shopNow()): boolean {
  if (date > now.date) return true;
  if (date < now.date) return false;
  return toMinutes(time) >= now.minutes + leadMinutes;
}

/** Whether a slot has already started (used by the admin view). */
export function hasStarted(date: string, time: string, now = shopNow()): boolean {
  if (date !== now.date) return date < now.date;
  return toMinutes(time) <= now.minutes;
}

export function bookingWindow(windowDays: number, now = shopNow()): { from: string; to: string } {
  return { from: now.date, to: addDays(now.date, windowDays - 1) };
}
