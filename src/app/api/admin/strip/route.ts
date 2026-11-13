import type { NextRequest } from "next/server";
import { getAdminCounts, getClosedDays } from "@/lib/bookings";
import { fail, json, requireAdmin } from "@/lib/http";
import { getSettings } from "@/lib/settings-store";
import { addDays, isDateString, scheduleSlots, shopNow, weekday } from "@/lib/time";

/**
 * Per-day summary for the barber's calendar: one month (?month=YYYY-MM, default this month),
 * padded to whole Monday–Sunday weeks.
 */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const today = shopNow().date;
  const month = request.nextUrl.searchParams.get("month") ?? today.slice(0, 7);
  const first = `${month}-01`;
  if (!/^\d{4}-\d{2}$/.test(month) || !isDateString(first)) return fail("invalid_month");

  const last = addDays(`${addDays(first, 32).slice(0, 7)}-01`, -1);
  const from = addDays(first, -((weekday(first) + 6) % 7));
  const to = addDays(last, (7 - weekday(last)) % 7);

  const [counts, closed, settings] = await Promise.all([getAdminCounts(from, to), getClosedDays(from, to), getSettings()]);
  const closedSet = new Set(closed);
  const days = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const capacity = scheduleSlots(d, settings).length;
    days.push({
      date: d,
      booked: counts[d] ?? 0,
      capacity,
      closed: closedSet.has(d) || capacity === 0,
      closedByBarber: closedSet.has(d),
    });
  }
  return json({ ok: true, today, month, days });
}
