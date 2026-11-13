import type { NextRequest } from "next/server";
import { adminBlock, adminBook, isValidAdminSlot } from "@/lib/bookings";
import { fail, json, readJson, requireAdmin } from "@/lib/http";

/** Block a free slot, or book it for a customer who phoned or walked in. */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const body = await readJson(request);
  if (!body || !isValidAdminSlot(body.date, body.time)) return fail("invalid_slot");
  const date = body.date as string;
  const time = body.time as string;

  const result =
    body.action === "block"
      ? await adminBlock(date, time)
      : body.action === "book"
        ? await adminBook({ date, time, name: body.name, phone: body.phone, note: body.note, service: body.service })
        : ({ ok: false, error: "invalid_action" } as const);

  if (!result.ok) return fail(result.error, result.error === "taken" ? 409 : 400);
  return json({ ok: true }, 201);
}
