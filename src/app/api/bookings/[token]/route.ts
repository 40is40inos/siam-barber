import type { NextRequest } from "next/server";
import { cancelByToken, getBookingByToken } from "@/lib/bookings";
import { fail, json } from "@/lib/http";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/bookings/[token]">) {
  const { token } = await ctx.params;
  const booking = await getBookingByToken(token);
  return booking ? json({ ok: true, booking }) : fail("not_found", 404);
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/bookings/[token]">) {
  const { token } = await ctx.params;
  const result = await cancelByToken(token);
  if (!result.ok) return fail(result.error, result.error === "not_found" ? 404 : 409);
  return json({ ok: true });
}
