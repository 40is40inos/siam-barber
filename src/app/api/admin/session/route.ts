import type { NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  adminConfigured,
  checkPassword,
  clearLoginFailures,
  clientIp,
  cookieOptions,
  createSession,
  isAdmin,
  loginLocked,
  recordLoginFailure,
} from "@/lib/auth";
import { fail, json, readJson } from "@/lib/http";

export async function GET(request: NextRequest) {
  return json({ ok: true, signedIn: isAdmin(request), configured: adminConfigured() });
}

export async function POST(request: NextRequest) {
  if (!adminConfigured()) return fail("not_configured", 503);
  const ip = clientIp(request);
  if (loginLocked(ip)) return fail("locked", 429);

  const body = await readJson(request);
  if (!checkPassword(body?.password)) {
    recordLoginFailure(ip);
    return fail("wrong_password", 401);
  }
  clearLoginFailures(ip);
  const session = createSession();
  const res = json({ ok: true });
  res.cookies.set(SESSION_COOKIE, session.value, { ...cookieOptions, maxAge: session.maxAge });
  return res;
}

export async function DELETE() {
  const res = json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return res;
}
