import type { NextRequest } from "next/server";
import { setDayClosed } from "@/lib/bookings";
import { fail, json, readJson, requireAdmin } from "@/lib/http";
import { isDateString } from "@/lib/time";

/** Close or reopen a whole day (holidays, sick days). Existing bookings stay. */
export async function PUT(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const body = await readJson(request);
  if (!body || !isDateString(body.date) || typeof body.closed !== "boolean") return fail("invalid_request");
  await setDayClosed(body.date, body.closed);
  return json({ ok: true });
}
