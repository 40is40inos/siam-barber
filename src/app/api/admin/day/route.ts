import type { NextRequest } from "next/server";
import { getAdminDay } from "@/lib/bookings";
import { fail, json, requireAdmin } from "@/lib/http";
import { isDateString } from "@/lib/time";

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const date = request.nextUrl.searchParams.get("date");
  if (!isDateString(date)) return fail("invalid_date");
  return json({ ok: true, day: await getAdminDay(date) });
}
