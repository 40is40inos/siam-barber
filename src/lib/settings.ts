/**
 * Shop settings the barber edits from /admin (stored in the database).
 * This file is shared by server and browser: types, defaults and validation only.
 * The first values come from config.ts until the barber saves his own.
 */
import { booking, openingHours, services as configServices, type Localized } from "./config";

export type ServiceSetting = {
  id: string;
  name: Localized;
  price: number;
  /** Removed from the menu but kept so old bookings still show their service. */
  archived?: boolean;
};

/** Opening ranges per weekday, 0 = Sunday … 6 = Saturday. */
export type WeekHours = Record<number, [string, string][]>;

export type Settings = {
  services: ServiceSetting[];
  hours: WeekHours;
  slotMinutes: number;
  windowDays: number;
  minLeadMinutes: number;
  maxActivePerPhone: number;
};

/** What the customer page needs to know. */
export type PublicShop = {
  services: { id: string; name: Localized; price: number }[];
  hours: WeekHours;
  slotMinutes: number;
};

export const DEFAULT_SETTINGS: Settings = {
  services: configServices.map(({ id, name, price }) => ({ id, name: { ...name }, price })),
  hours: Object.fromEntries(Object.entries(openingHours).map(([d, r]) => [d, r.map(([a, b]) => [a, b])])) as WeekHours,
  slotMinutes: booking.slotMinutes,
  windowDays: booking.windowDays,
  minLeadMinutes: booking.minLeadMinutes,
  maxActivePerPhone: booking.maxActivePerPhone,
};

export const SLOT_CHOICES = [15, 20, 30, 40, 45, 50, 60, 75, 90, 120];

export function activeServices(s: Pick<Settings, "services">) {
  return s.services.filter((x) => !x.archived);
}

export function findService(s: Pick<Settings, "services">, id: string | null | undefined) {
  return s.services.find((x) => x.id === id);
}

export function toPublicShop(s: Settings): PublicShop {
  return {
    services: activeServices(s).map(({ id, name, price }) => ({ id, name, price })),
    hours: s.hours,
    slotMinutes: s.slotMinutes,
  };
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export type SettingsError =
  | "invalid"
  | "no_services"
  | "too_many_services"
  | "service_name"
  | "service_price"
  | "hours_format"
  | "hours_order"
  | "hours_overlap"
  | "rules";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** Checks one weekday's ranges; returns an error code or null. */
export function checkDayRanges(ranges: [string, string][]): SettingsError | null {
  for (const [a, b] of ranges) {
    if (!TIME.test(a) || !TIME.test(b)) return "hours_format";
    if (toMin(a) >= toMin(b)) return "hours_order";
  }
  const sorted = [...ranges].sort((x, y) => toMin(x[0]) - toMin(y[0]));
  for (let i = 1; i < sorted.length; i++) {
    if (toMin(sorted[i][0]) < toMin(sorted[i - 1][1])) return "hours_overlap";
  }
  return null;
}

export function validateSettings(input: unknown): { ok: true; settings: Settings } | { ok: false; error: SettingsError } {
  if (!input || typeof input !== "object") return { ok: false, error: "invalid" };
  const raw = input as Record<string, unknown>;

  // Services
  if (!Array.isArray(raw.services)) return { ok: false, error: "invalid" };
  if (raw.services.length > 40) return { ok: false, error: "too_many_services" };
  const services: ServiceSetting[] = [];
  const ids = new Set<string>();
  for (const item of raw.services) {
    const s = item as Record<string, unknown>;
    const name = s?.name as Record<string, unknown> | undefined;
    const id = typeof s?.id === "string" && /^[\w-]{1,40}$/.test(s.id) ? s.id : null;
    if (!id || ids.has(id)) return { ok: false, error: "invalid" };
    const el = typeof name?.el === "string" ? name.el.trim() : "";
    const en = typeof name?.en === "string" ? name.en.trim() : "";
    const archived = s.archived === true;
    if (!archived && (el.length < 1 || el.length > 60 || en.length > 60)) return { ok: false, error: "service_name" };
    const price = typeof s.price === "number" ? Math.round(s.price * 100) / 100 : NaN;
    if (!(price >= 0 && price <= 1000)) return { ok: false, error: "service_price" };
    ids.add(id);
    services.push({ id, name: { el: el || id, en: en || el || id }, price, ...(archived ? { archived: true } : {}) });
  }
  if (!services.some((s) => !s.archived)) return { ok: false, error: "no_services" };
  if (services.filter((s) => !s.archived).length > 20) return { ok: false, error: "too_many_services" };

  // Hours
  const hoursRaw = raw.hours as Record<string, unknown> | undefined;
  if (!hoursRaw || typeof hoursRaw !== "object") return { ok: false, error: "invalid" };
  const hours: WeekHours = {};
  for (let d = 0; d < 7; d++) {
    const list = hoursRaw[d] ?? hoursRaw[String(d)] ?? [];
    if (!Array.isArray(list) || list.length > 4) return { ok: false, error: "hours_format" };
    const ranges: [string, string][] = [];
    for (const r of list) {
      if (!Array.isArray(r) || r.length !== 2 || typeof r[0] !== "string" || typeof r[1] !== "string") {
        return { ok: false, error: "hours_format" };
      }
      ranges.push([r[0], r[1]]);
    }
    const err = checkDayRanges(ranges);
    if (err) return { ok: false, error: err };
    hours[d] = ranges.sort((x, y) => toMin(x[0]) - toMin(y[0]));
  }

  // Rules
  const { slotMinutes, windowDays, minLeadMinutes, maxActivePerPhone } = raw;
  if (
    !isInt(slotMinutes, 10, 240) ||
    slotMinutes % 5 !== 0 ||
    !isInt(windowDays, 1, 180) ||
    !isInt(minLeadMinutes, 0, 2880) ||
    !isInt(maxActivePerPhone, 1, 20)
  ) {
    return { ok: false, error: "rules" };
  }

  return { ok: true, settings: { services, hours, slotMinutes, windowDays, minLeadMinutes, maxActivePerPhone } };
}
