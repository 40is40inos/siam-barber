import type { NextRequest } from "next/server";
import { createBooking } from "@/lib/bookings";
import { fail, json, readJson } from "@/lib/http";

const STATUS: Record<string, number> = { taken: 409, past: 409, closed: 409, limit: 429 };

export async function POST(request: NextRequest) {
  const body = await readJson(request);
  if (!body) return fail("invalid_request");
  // Honeypot: real people never see or fill this field.
  if (typeof body.website === "string" && body.website.trim() !== "") return fail("invalid_request");

  const result = await createBooking({
    date: body.date,
    time: body.time,
    service: body.service,
    name: body.name,
    phone: body.phone,
    note: body.note,
  });
  if (!result.ok) return fail(result.error, STATUS[result.error] ?? 400);
  return json({ ok: true, booking: result.booking }, 201);
}
