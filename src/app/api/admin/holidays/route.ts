import type { NextRequest } from "next/server";
import { addHolidays, listHolidays, removeHolidays } from "@/lib/bookings";
import { fail, json, readJson, requireAdmin } from "@/lib/http";
import { addDays, isDateString, shopNow } from "@/lib/time";

/** Upcoming closed days (holidays, time off), today included. */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  return json({ ok: true, holidays: await listHolidays(shopNow().date) });
}

/** Close a range of days: { from, to, note? }. */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const body = await readJson(request);
  const from = body?.from;
  const to = body?.to ?? from;
  if (!isDateString(from) || !isDateString(to) || to < from || addDays(from, 366) < to) return fail("invalid_range");
  const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim().slice(0, 80) : null;
  const booked = await addHolidays(from, to, note);
  return json({ ok: true, booked }, 201);
}

/** Reopen days: { dates: [...] }. */
export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const body = await readJson(request);
  const dates = Array.isArray(body?.dates) ? body.dates.filter(isDateString).slice(0, 400) : [];
  if (!dates.length) return fail("invalid_request");
  await removeHolidays(dates);
  return json({ ok: true });
}
