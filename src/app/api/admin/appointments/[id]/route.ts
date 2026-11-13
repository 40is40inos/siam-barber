import type { NextRequest } from "next/server";
import { adminRelease } from "@/lib/bookings";
import { fail, json, requireAdmin } from "@/lib/http";

/** Cancel a booking or lift a block. */
export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/admin/appointments/[id]">) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const { id } = await ctx.params;
  const result = await adminRelease(id);
  return result.ok ? json({ ok: true }) : fail(result.error, 404);
}
