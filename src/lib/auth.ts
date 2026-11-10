import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * The barber signs in with ADMIN_PASSWORD. The session is a signed, HttpOnly cookie
 * holding only its expiry time; changing the password signs every device out.
 */

export const SESSION_COOKIE = "siam_admin";
const SESSION_DAYS = 30;

function secret(): string | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  return createHash("sha256")
    .update(`${process.env.SESSION_SECRET ?? ""}:${password}`)
    .digest("hex");
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function checkPassword(input: unknown): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || typeof input !== "string") return false;
  const a = createHash("sha256").update(input).digest("hex");
  const b = createHash("sha256").update(password).digest("hex");
  return safeEqual(a, b);
}

export function createSession(): { value: string; maxAge: number } {
  const key = secret();
  if (!key) throw new Error("ADMIN_PASSWORD is not set");
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const expires = String(Date.now() + maxAge * 1000);
  return { value: `${expires}.${sign(expires, key)}`, maxAge };
}

export function isAdmin(request: NextRequest): boolean {
  const key = secret();
  const value = request.cookies.get(SESSION_COOKIE)?.value;
  if (!key || !value) return false;
  const [expires, signature] = value.split(".");
  if (!expires || !signature || !safeEqual(signature, sign(expires, key))) return false;
  return Number(expires) > Date.now();
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/* Small in-memory brake on password guessing (per server instance). */
const attempts = new Map<string, { count: number; until: number }>();

export function loginLocked(ip: string): boolean {
  const a = attempts.get(ip);
  return Boolean(a && a.count >= 5 && a.until > Date.now());
}

export function recordLoginFailure(ip: string) {
  const a = attempts.get(ip);
  const fresh = !a || a.until < Date.now();
  attempts.set(ip, { count: fresh ? 1 : a.count + 1, until: Date.now() + 10 * 60 * 1000 });
}

export function clearLoginFailures(ip: string) {
  attempts.delete(ip);
}

export function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
