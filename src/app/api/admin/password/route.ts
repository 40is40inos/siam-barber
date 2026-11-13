import type { NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  adminState,
  changePassword,
  checkPassword,
  clearLoginFailures,
  clientIp,
  cookieOptions,
  createFirstPassword,
  createSession,
  isAdmin,
  loginLocked,
  recordLoginFailure,
  validNewPassword,
} from "@/lib/auth";
import { fail, json, readJson } from "@/lib/http";

async function signedInResponse() {
  const session = await createSession();
  const res = json({ ok: true });
  res.cookies.set(SESSION_COOKIE, session.value, { ...cookieOptions, maxAge: session.maxAge });
  return res;
}

/**
 * First-time setup: { password }. Only works while no password exists yet; the first one to set it
 * owns it, so this should be done right after deploying. Signs the browser in.
 */
export async function POST(request: NextRequest) {
  if ((await adminState()) !== "needs_setup") return fail("already_set", 409);
  const body = await readJson(request);
  if (!validNewPassword(body?.password)) return fail("weak_password");
  if (!(await createFirstPassword(body.password))) return fail("already_set", 409);
  return signedInResponse();
}

/**
 * Change password: { current, password }. Requires being signed in and the current password.
 * Every other device is signed out (the session key depends on the password); this one stays in.
 */
export async function PUT(request: NextRequest) {
  if (!(await isAdmin(request))) return fail("unauthorized", 401);
  const ip = clientIp(request);
  if (await loginLocked(ip)) return fail("locked", 429);

  const body = await readJson(request);
  if (!(await checkPassword(body?.current))) {
    await recordLoginFailure(ip);
    return fail("wrong_password", 401);
  }
  if (!validNewPassword(body?.password)) return fail("weak_password");
  await clearLoginFailures(ip);
  await changePassword(body.password);
  return signedInResponse();
}
