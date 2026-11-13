/**
 * "Add to calendar" for a booking, without downloading a file:
 * - Apple devices open /api/bookings/<token>/ics, which the system hands straight to Apple Calendar.
 * - Everyone else gets Google Calendar's "new event" page, pre-filled.
 * - Outlook is offered as an extra link.
 * All times are converted from the shop's zone to exact UTC so every calendar shows the right hour.
 * Shared by browser and server (the .ics route), so no Node-only imports here.
 */
import { shop, type Lang, type Localized } from "./config";

export type CalendarBooking = {
  token: string;
  date: string; // YYYY-MM-DD, shop time
  time: string; // HH:MM, shop time
  minutes: number;
  serviceInfo: { name: Localized } | null;
};

/** Minutes the zone is ahead of UTC at a given instant (e.g. +120 for Athens in winter). */
function zoneOffsetMinutes(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - utcMs) / 60000);
}

/** A wall-clock date and time in `timeZone` as an exact instant (handles summer time). */
export function zonedToUtc(date: string, time: string, timeZone = shop.timeZone): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = zoneOffsetMinutes(guess, timeZone);
  let utc = guess - first * 60000;
  const second = zoneOffsetMinutes(utc, timeZone);
  if (second !== first) utc = guess - second * 60000;
  return new Date(utc);
}

/** 20261110T134500Z */
const basic = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function eventOf(b: CalendarBooking, lang: Lang, origin: string) {
  const start = zonedToUtc(b.date, b.time);
  const end = new Date(start.getTime() + b.minutes * 60000);
  const title = b.serviceInfo ? `${b.serviceInfo.name[lang]} · ${shop.name}` : shop.name;
  const cancel = `${origin}/cancel#${b.token}`;
  const details = lang === "el" ? `Ακύρωση ραντεβού: ${cancel}` : `Cancel appointment: ${cancel}`;
  return { start, end, title, details, location: shop.area[lang] || shop.name };
}

export function googleCalendarUrl(b: CalendarBooking, lang: Lang, origin: string): string {
  const e = eventOf(b, lang, origin);
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${basic(e.start)}/${basic(e.end)}`,
    details: e.details,
    location: e.location,
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

export function outlookCalendarUrl(b: CalendarBooking, lang: Lang, origin: string): string {
  const e = eventOf(b, lang, origin);
  const q = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: e.title,
    startdt: e.start.toISOString(),
    enddt: e.end.toISOString(),
    body: e.details,
    location: e.location,
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${q}`;
}

/** Served by /api/bookings/<token>/ics; Apple devices open it in Calendar instead of downloading. */
export function icsPath(token: string, lang: Lang): string {
  return `/api/bookings/${encodeURIComponent(token)}/ics?lang=${lang}`;
}

const escapeText = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

export function icsText(b: CalendarBooking, lang: Lang, origin: string): string {
  const e = eventOf(b, lang, origin);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Siam Barber//Booking//EL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${b.token}@siam-barber`,
    `DTSTAMP:${basic(new Date())}`,
    `DTSTART:${basic(e.start)}`,
    `DTEND:${basic(e.end)}`,
    `SUMMARY:${escapeText(e.title)}`,
    `DESCRIPTION:${escapeText(e.details)}`,
    `LOCATION:${escapeText(e.location)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(e.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

/** iPhone, iPad (which reports itself as a Mac) and Mac. */
export function isAppleDevice(): boolean {
  return typeof navigator !== "undefined" && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
}
