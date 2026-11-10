import { randomBytes, randomUUID } from "node:crypto";
import type { Client, Row, Transaction } from "@libsql/client";
import type { Localized } from "./config";
import { LEGACY_MINUTES, db, isUniqueViolation } from "./db";
import { activeServices, findService, type Settings } from "./settings";
import { getSettings } from "./settings-store";
import {
  addDays,
  bookingWindow,
  hasStarted,
  isDateString,
  isFutureEnough,
  isTimeString,
  overlaps,
  scheduleSlots,
  shopNow,
  withinHours,
} from "./time";
import { normalizeName, normalizeNote, normalizePhone } from "./validate";

export type Appointment = {
  id: string;
  token: string;
  date: string;
  time: string;
  minutes: number;
  kind: "booking" | "block";
  service: string | null;
  name: string | null;
  phone: string | null;
  note: string | null;
  source: "online" | "admin";
  createdAt: string;
};

export type PublicBooking = Pick<Appointment, "date" | "time" | "service" | "name" | "minutes"> & {
  token: string;
  status: "active" | "cancelled";
  started: boolean;
  /** Service name and price as they are now, so customer pages don't need the settings. */
  serviceInfo: { name: Localized; price: number } | null;
};

export type DayAvailability = { date: string; open: boolean; slots: string[]; note?: string | null };

function toAppointment(r: Row): Appointment {
  const s = (v: unknown) => (v === null || v === undefined ? null : String(v));
  return {
    id: String(r.id),
    token: String(r.token),
    date: String(r.date),
    time: String(r.time),
    minutes: r.minutes === null || r.minutes === undefined ? LEGACY_MINUTES : Number(r.minutes),
    kind: r.kind === "block" ? "block" : "booking",
    service: s(r.service),
    name: s(r.name),
    phone: s(r.phone),
    note: s(r.note),
    source: r.source === "admin" ? "admin" : "online",
    createdAt: String(r.created_at),
  };
}

function withoutToken({ token, ...rest }: Appointment): Omit<Appointment, "token"> {
  void token;
  return rest;
}

function serviceInfo(settings: Settings, id: string | null) {
  const s = findService(settings, id);
  return s ? { name: s.name, price: s.price } : null;
}

const newToken = () => randomBytes(18).toString("base64url");
const nowIso = () => new Date().toISOString();

type Exec = Pick<Client | Transaction, "execute">;

/** Active bookings and blocks on a date, as [start, minutes] pairs. */
async function busyOn(exec: Exec, date: string): Promise<{ time: string; minutes: number }[]> {
  const res = await exec.execute({
    sql: "SELECT time, minutes FROM appointments WHERE status = 'active' AND date = ?",
    args: [date],
  });
  return res.rows.map((r) => ({
    time: String(r.time),
    minutes: r.minutes === null || r.minutes === undefined ? LEGACY_MINUTES : Number(r.minutes),
  }));
}

const clashes = (busy: { time: string; minutes: number }[], time: string, minutes: number) =>
  busy.some((b) => overlaps(b.time, b.minutes, time, minutes));

/**
 * Runs a write in one transaction so the overlap check and the insert can't interleave
 * with another booking for the same time.
 */
async function inWriteTx<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  const client = await db();
  const tx = await client.transaction("write");
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } finally {
    tx.close();
  }
}

/* ------------------------------------------------------------------ */
/* Customer side                                                       */
/* ------------------------------------------------------------------ */

export async function getAvailability(): Promise<{ today: string; days: DayAvailability[]; settings: Settings }> {
  const settings = await getSettings();
  const now = shopNow();
  const { from, to } = bookingWindow(settings.windowDays, now);
  const client = await db();
  const [taken, closed] = await Promise.all([
    client.execute({
      sql: "SELECT date, time, minutes FROM appointments WHERE status = 'active' AND date BETWEEN ? AND ?",
      args: [from, to],
    }),
    client.execute({ sql: "SELECT date, note FROM closed_days WHERE date BETWEEN ? AND ?", args: [from, to] }),
  ]);
  const busy = new Map<string, { time: string; minutes: number }[]>();
  for (const r of taken.rows) {
    const list = busy.get(String(r.date)) ?? [];
    list.push({ time: String(r.time), minutes: r.minutes == null ? LEGACY_MINUTES : Number(r.minutes) });
    busy.set(String(r.date), list);
  }
  const closedMap = new Map(closed.rows.map((r) => [String(r.date), r.note == null ? null : String(r.note)]));

  const days: DayAvailability[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const schedule = scheduleSlots(d, settings);
    const isClosed = closedMap.has(d);
    const open = schedule.length > 0 && !isClosed;
    const dayBusy = busy.get(d) ?? [];
    days.push({
      date: d,
      open,
      note: isClosed ? closedMap.get(d) : null,
      slots: open
        ? schedule.filter(
            (t) => !clashes(dayBusy, t, settings.slotMinutes) && isFutureEnough(d, t, settings.minLeadMinutes, now),
          )
        : [],
    });
  }
  return { today: now.date, days, settings };
}

export type BookingError =
  | "invalid_name"
  | "invalid_phone"
  | "invalid_note"
  | "invalid_service"
  | "invalid_slot"
  | "closed"
  | "past"
  | "taken"
  | "limit";

export async function createBooking(input: {
  date: unknown;
  time: unknown;
  service: unknown;
  name: unknown;
  phone: unknown;
  note?: unknown;
}): Promise<{ ok: true; booking: PublicBooking } | { ok: false; error: BookingError }> {
  const settings = await getSettings();
  const name = normalizeName(input.name);
  if (!name) return { ok: false, error: "invalid_name" };
  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false, error: "invalid_phone" };
  const note = normalizeNote(input.note);
  if (note === false) return { ok: false, error: "invalid_note" };
  const offered = activeServices(settings);
  const service = typeof input.service === "string" ? offered.find((s) => s.id === input.service) : offered[0];
  if (!service) return { ok: false, error: "invalid_service" };

  const { date, time } = input;
  if (!isDateString(date) || !isTimeString(time)) return { ok: false, error: "invalid_slot" };

  const now = shopNow();
  const { from, to } = bookingWindow(settings.windowDays, now);
  if (date < from || date > to || !scheduleSlots(date, settings).includes(time)) {
    return { ok: false, error: "invalid_slot" };
  }
  if (!isFutureEnough(date, time, settings.minLeadMinutes, now)) return { ok: false, error: "past" };

  const minutes = settings.slotMinutes;
  const token = newToken();
  try {
    const error = await inWriteTx(async (tx): Promise<BookingError | null> => {
      const closed = await tx.execute({ sql: "SELECT 1 FROM closed_days WHERE date = ?", args: [date] });
      if (closed.rows.length) return "closed";

      const held = await tx.execute({
        sql: `SELECT date, time FROM appointments
              WHERE status = 'active' AND kind = 'booking' AND phone = ? AND date >= ?`,
        args: [phone, now.date],
      });
      const upcoming = held.rows.filter((r) => !hasStarted(String(r.date), String(r.time), now));
      if (upcoming.length >= settings.maxActivePerPhone) return "limit";

      if (clashes(await busyOn(tx, date), time, minutes)) return "taken";

      await tx.execute({
        sql: `INSERT INTO appointments (id, token, date, time, minutes, kind, service, name, phone, note, source, created_at)
              VALUES (?, ?, ?, ?, ?, 'booking', ?, ?, ?, ?, 'online', ?)`,
        args: [randomUUID(), token, date, time, minutes, service.id, name, phone, note, nowIso()],
      });
      return null;
    });
    if (error) return { ok: false, error };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "taken" };
    throw err;
  }
  return {
    ok: true,
    booking: {
      token,
      date,
      time,
      minutes,
      service: service.id,
      name,
      status: "active",
      started: false,
      serviceInfo: { name: service.name, price: service.price },
    },
  };
}

export async function getBookingByToken(token: string): Promise<PublicBooking | null> {
  if (!/^[\w-]{16,64}$/.test(token)) return null;
  const client = await db();
  const res = await client.execute({
    sql: "SELECT * FROM appointments WHERE token = ? AND kind = 'booking'",
    args: [token],
  });
  const row = res.rows[0];
  if (!row) return null;
  const a = toAppointment(row);
  const settings = await getSettings();
  return {
    token: a.token,
    date: a.date,
    time: a.time,
    minutes: a.minutes,
    service: a.service,
    name: a.name,
    status: row.status === "active" ? "active" : "cancelled",
    started: hasStarted(a.date, a.time),
    serviceInfo: serviceInfo(settings, a.service),
  };
}

export async function cancelByToken(
  token: string,
): Promise<{ ok: true } | { ok: false; error: "not_found" | "started" }> {
  const found = await getBookingByToken(token);
  if (!found) return { ok: false, error: "not_found" };
  if (found.status === "cancelled") return { ok: true };
  if (found.started) return { ok: false, error: "started" };
  const client = await db();
  await client.execute({
    sql: `UPDATE appointments SET status = 'cancelled', cancelled_at = ?, cancelled_by = 'customer'
          WHERE token = ? AND status = 'active'`,
    args: [nowIso(), token],
  });
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Barber side                                                         */
/* ------------------------------------------------------------------ */

export type AdminSlot = {
  time: string;
  started: boolean;
  inSchedule: boolean;
  appointment: Omit<Appointment, "token"> | null;
};

export async function getAdminDay(
  date: string,
): Promise<{ date: string; closed: boolean; note: string | null; slots: AdminSlot[] }> {
  const settings = await getSettings();
  const client = await db();
  const [res, closed] = await Promise.all([
    client.execute({
      sql: "SELECT * FROM appointments WHERE status = 'active' AND date = ? ORDER BY time",
      args: [date],
    }),
    client.execute({ sql: "SELECT note FROM closed_days WHERE date = ?", args: [date] }),
  ]);
  const now = shopNow();
  const appointments = res.rows.map(toAppointment);
  const byTime = new Map(appointments.map((a) => [a.time, a]));
  const schedule = scheduleSlots(date, settings);
  // A free slot that overlaps a booking at another time (after the slot length changed) is not free.
  const freeSlots = schedule.filter(
    (t) => byTime.has(t) || !appointments.some((a) => overlaps(a.time, a.minutes, t, settings.slotMinutes)),
  );
  const times = [...new Set([...freeSlots, ...byTime.keys()])].sort();
  const closedRow = closed.rows[0];
  return {
    date,
    closed: Boolean(closedRow),
    note: closedRow?.note == null ? null : String(closedRow.note),
    slots: times.map((time) => {
      const a = byTime.get(time);
      return {
        time,
        started: hasStarted(date, time, now),
        // Bookings: inside opening hours at all. Empty rows always come from the schedule.
        inSchedule: a ? withinHours(date, time, a.minutes, settings) : true,
        appointment: a ? withoutToken(a) : null,
      };
    }),
  };
}

/** Booked-appointment counts per day, for the barber's calendar. */
export async function getAdminCounts(from: string, to: string): Promise<Record<string, number>> {
  const client = await db();
  const res = await client.execute({
    sql: `SELECT date, COUNT(*) AS n FROM appointments
          WHERE status = 'active' AND kind = 'booking' AND date BETWEEN ? AND ?
          GROUP BY date`,
    args: [from, to],
  });
  return Object.fromEntries(res.rows.map((r) => [String(r.date), Number(r.n)]));
}

export async function getClosedDays(from: string, to: string): Promise<string[]> {
  const client = await db();
  const res = await client.execute({
    sql: "SELECT date FROM closed_days WHERE date BETWEEN ? AND ?",
    args: [from, to],
  });
  return res.rows.map((r) => String(r.date));
}

type AdminResult = { ok: true } | { ok: false; error: string };

async function adminInsert(fields: {
  date: string;
  time: string;
  kind: "booking" | "block";
  service?: string | null;
  name?: string | null;
  phone?: string | null;
  note?: string | null;
}): Promise<AdminResult> {
  const settings = await getSettings();
  const minutes = settings.slotMinutes;
  try {
    const taken = await inWriteTx(async (tx) => {
      if (clashes(await busyOn(tx, fields.date), fields.time, minutes)) return true;
      await tx.execute({
        sql: `INSERT INTO appointments (id, token, date, time, minutes, kind, service, name, phone, note, source, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin', ?)`,
        args: [
          randomUUID(),
          newToken(),
          fields.date,
          fields.time,
          minutes,
          fields.kind,
          fields.service ?? null,
          fields.name ?? null,
          fields.phone ?? null,
          fields.note ?? null,
          nowIso(),
        ],
      });
      return false;
    });
    return taken ? { ok: false, error: "taken" } : { ok: true };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "taken" };
    throw err;
  }
}

export function adminBlock(date: string, time: string): Promise<AdminResult> {
  return adminInsert({ date, time, kind: "block" });
}

export async function adminBook(input: {
  date: string;
  time: string;
  name: unknown;
  phone: unknown;
  note?: unknown;
  service: unknown;
}): Promise<AdminResult> {
  const name = typeof input.name === "string" && input.name.trim() ? normalizeName(input.name) : null;
  if (typeof input.name === "string" && input.name.trim() && !name) return { ok: false, error: "invalid_name" };
  const phone = typeof input.phone === "string" && input.phone.trim() ? normalizePhone(input.phone) : null;
  if (typeof input.phone === "string" && input.phone.trim() && !phone) return { ok: false, error: "invalid_phone" };
  const note = normalizeNote(input.note);
  if (note === false) return { ok: false, error: "invalid_note" };
  const offered = activeServices(await getSettings());
  const service = typeof input.service === "string" ? offered.find((s) => s.id === input.service) : offered[0];
  if (!service) return { ok: false, error: "invalid_service" };
  return adminInsert({ date: input.date, time: input.time, kind: "booking", service: service.id, name, phone, note });
}

/** Cancels a booking or removes a block. */
export async function adminRelease(id: string): Promise<AdminResult> {
  const client = await db();
  const res = await client.execute({
    sql: `UPDATE appointments SET status = 'cancelled', cancelled_at = ?, cancelled_by = 'barber'
          WHERE id = ? AND status = 'active'`,
    args: [nowIso(), id],
  });
  return res.rowsAffected ? { ok: true } : { ok: false, error: "not_found" };
}

export async function setDayClosed(date: string, closed: boolean): Promise<AdminResult> {
  const client = await db();
  await client.execute(
    closed
      ? { sql: "INSERT OR IGNORE INTO closed_days (date, created_at) VALUES (?, ?)", args: [date, nowIso()] }
      : { sql: "DELETE FROM closed_days WHERE date = ?", args: [date] },
  );
  return { ok: true };
}

/* Holidays: ranges of closed days with an optional note, managed from Settings. */

export type Holiday = { date: string; note: string | null; booked: number };

export async function listHolidays(from: string): Promise<Holiday[]> {
  const client = await db();
  const res = await client.execute({
    sql: `SELECT c.date, c.note,
            (SELECT COUNT(*) FROM appointments a
              WHERE a.date = c.date AND a.status = 'active' AND a.kind = 'booking') AS booked
          FROM closed_days c WHERE c.date >= ? ORDER BY c.date LIMIT 400`,
    args: [from],
  });
  return res.rows.map((r) => ({
    date: String(r.date),
    note: r.note == null ? null : String(r.note),
    booked: Number(r.booked),
  }));
}

/** Closes every day from..to (inclusive). Returns how many bookings already sit on those days. */
export async function addHolidays(from: string, to: string, note: string | null): Promise<number> {
  const client = await db();
  const stmts = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    stmts.push({
      sql: `INSERT INTO closed_days (date, created_at, note) VALUES (?, ?, ?)
            ON CONFLICT(date) DO UPDATE SET note = excluded.note`,
      args: [d, nowIso(), note],
    });
  }
  await client.batch(stmts, "write");
  const res = await client.execute({
    sql: `SELECT COUNT(*) AS n FROM appointments
          WHERE status = 'active' AND kind = 'booking' AND date BETWEEN ? AND ?`,
    args: [from, to],
  });
  return Number(res.rows[0]?.n ?? 0);
}

export async function removeHolidays(dates: string[]): Promise<void> {
  if (!dates.length) return;
  const client = await db();
  await client.batch(
    dates.map((d) => ({ sql: "DELETE FROM closed_days WHERE date = ?", args: [d] })),
    "write",
  );
}

export function isValidAdminSlot(date: unknown, time: unknown): boolean {
  return isDateString(date) && isTimeString(time);
}
