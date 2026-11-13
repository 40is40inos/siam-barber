import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "./auth";

const noStore = { "Cache-Control": "no-store" };

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: noStore });
}

export function fail(error: string, status = 400) {
  return json({ ok: false, error }, status);
}

export async function readJson(request: NextRequest): Promise<Record<string, unknown> | null> {
  if (!request.headers.get("content-type")?.includes("application/json")) return null;
  const body = await request.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

/** Returns a 401 response when the request has no valid barber session. */
export async function requireAdmin(request: NextRequest) {
  return (await isAdmin(request)) ? null : fail("unauthorized", 401);
}
