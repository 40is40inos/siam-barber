import type { NextRequest } from "next/server";
import { getBookingByToken } from "@/lib/bookings";
import { icsText } from "@/lib/calendar";
import { fail } from "@/lib/http";

/**
 * The booking as a calendar event. Served "inline" with text/calendar, so iPhone/iPad/Mac open it
 * in Apple Calendar's "Add event" screen instead of saving a file.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/bookings/[token]/ics">) {
  const { token } = await ctx.params;
  const booking = await getBookingByToken(token);
  if (!booking || booking.status !== "active") return fail("not_found", 404);
  const lang = request.nextUrl.searchParams.get("lang") === "en" ? "en" : "el";
  return new Response(icsText(booking, lang, request.nextUrl.origin), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="siam-barber-${booking.date}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
