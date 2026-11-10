import { shop, type Lang, type Localized } from "./config";
import { fromMinutes, toMinutes } from "./time";

const stamp = (date: string, time: string) => `${date.replaceAll("-", "")}T${time.replace(":", "")}00`;

/** Builds an .ics file for the appointment and hands it to the browser. */
export function downloadIcs(
  b: { token: string; date: string; time: string; minutes: number; serviceInfo: { name: Localized } | null },
  lang: Lang,
) {
  const end = fromMinutes(toMinutes(b.time) + b.minutes);
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const summary = b.serviceInfo ? `${b.serviceInfo.name[lang]} · ${shop.name}` : shop.name;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Siam Barber//Booking//EL",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${b.token}@siam-barber`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=${shop.timeZone}:${stamp(b.date, b.time)}`,
    `DTEND;TZID=${shop.timeZone}:${stamp(b.date, end)}`,
    `SUMMARY:${summary}`,
    ...(shop.area[lang] ? [`LOCATION:${shop.area[lang]}`] : []),
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${summary}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `siam-barber-${b.date}.ics`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
