import type { NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  adminState,
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

/** Who is this browser? Also tells the login screen whether a password still has to be created. */
export async function GET(request: NextRequest) {
  const [signedIn, state] = await Promise.all([isAdmin(request), adminState()]);
  return json({ ok: true, signedIn, needsSetup: state === "needs_setup" });
}

/** Sign in with the barber's password. */
export async function POST(request: NextRequest) {
  if ((await adminState()) === "needs_setup") return fail("needs_setup", 409);
  const ip = clientIp(request);
  if (await loginLocked(ip)) return fail("locked", 429);

  const body = await readJson(request);
  if (!(await checkPassword(body?.password))) {
    await recordLoginFailure(ip);
    return fail("wrong_password", 401);
  }
  await clearLoginFailures(ip);
  const session = await createSession();
  const res = json({ ok: true });
  res.cookies.set(SESSION_COOKIE, session.value, { ...cookieOptions, maxAge: session.maxAge });
  return res;
}

export async function DELETE() {
  const res = json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return res;
}
