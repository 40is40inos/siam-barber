import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { db } from "./db";

/**
 * Barber login, with no environment variables required.
 *
 * - The password is set by the barber himself: the first visit to /admin offers "create password"
 *   (until one exists, whoever opens /admin first can set it, so set it right after deploying),
 *   and Settings → Change password replaces it later. Stored as a salted PBKDF2 hash in `settings`.
 * - Optional fallback: if no password was created yet but ADMIN_PASSWORD is set in the environment,
 *   that one works and the create-password screen is not offered.
 * - The session cookie holds only an expiry time, HMAC-signed with a random key that is generated once
 *   and stored in `settings`. The signing key is mixed with the current password hash, so changing the
 *   password signs every other device out.
 */

export const SESSION_COOKIE = "siam_admin";
const SESSION_DAYS = 30;

/*
 * PBKDF2-SHA256 via Web Crypto (native in Node and in Cloudflare Workers). The iteration count is stored
 * with each hash so it can be raised later; it is kept moderate because the Workers free plan allows only
 * ~10 ms of CPU per request. Brute force is additionally slowed by the per-IP lockout below.
 */
const PBKDF2_ITERATIONS = 20_000;
export const PASSWORD_MIN = 8;
const PASSWORD_MAX = 200;

const KEY_PASSWORD = "auth_password";
const KEY_SIGNING = "auth_signing_key";

type StoredPassword = { hash: string; salt: string; iterations: number };

const b64url = (bytes: ArrayBuffer | Uint8Array) => Buffer.from(bytes as ArrayBuffer).toString("base64url");

async function pbkdf2(password: string, salt: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: Buffer.from(salt, "base64url"), iterations },
    key,
    256,
  );
  return b64url(bits);
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

async function readSetting(key: string): Promise<string | null> {
  const client = await db();
  const res = await client.execute({ sql: "SELECT value FROM settings WHERE key = ?", args: [key] });
  const v = res.rows[0]?.value;
  return typeof v === "string" ? v : null;
}

async function storedPassword(): Promise<StoredPassword | null> {
  const raw = await readSetting(KEY_PASSWORD);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as StoredPassword;
    return p.hash && p.salt && p.iterations ? p : null;
  } catch {
    return null;
  }
}

/** The random signing key, created on first use (safe if two requests race: the first insert wins). */
async function signingKey(): Promise<string> {
  const existing = await readSetting(KEY_SIGNING);
  if (existing) return existing;
  const client = await db();
  await client.execute({
    sql: "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO NOTHING",
    args: [KEY_SIGNING, randomBytes(32).toString("base64url"), new Date().toISOString()],
  });
  return (await readSetting(KEY_SIGNING))!;
}

/** Key used to sign sessions: changes whenever the password changes. */
async function sessionKey(): Promise<string | null> {
  const stored = await storedPassword();
  const envPassword = process.env.ADMIN_PASSWORD;
  const stamp = stored?.hash ?? (envPassword ? createHash("sha256").update(envPassword).digest("hex") : null);
  if (!stamp) return null;
  return `${await signingKey()}:${stamp}`;
}

/* ------------------------------------------------------------------ */

export type AdminState = "needs_setup" | "ready";

export async function adminState(): Promise<AdminState> {
  if (await storedPassword()) return "ready";
  return process.env.ADMIN_PASSWORD ? "ready" : "needs_setup";
}

export async function checkPassword(input: unknown): Promise<boolean> {
  if (typeof input !== "string" || input.length > PASSWORD_MAX) return false;
  const stored = await storedPassword();
  if (stored) return safeEqual(await pbkdf2(input, stored.salt, stored.iterations), stored.hash);
  const envPassword = process.env.ADMIN_PASSWORD;
  if (!envPassword) return false;
  const a = createHash("sha256").update(input).digest("hex");
  const b = createHash("sha256").update(envPassword).digest("hex");
  return safeEqual(a, b);
}

/** At least PASSWORD_MIN characters (not counting surrounding spaces), at most PASSWORD_MAX. */
export function validNewPassword(input: unknown): input is string {
  return typeof input === "string" && input.trim().length >= PASSWORD_MIN && input.length <= PASSWORD_MAX;
}

async function hashNew(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return JSON.stringify({ hash, salt, iterations: PBKDF2_ITERATIONS } satisfies StoredPassword);
}

/** First-time setup. Returns false if a password already exists (someone else got there first). */
export async function createFirstPassword(password: string): Promise<boolean> {
  if ((await adminState()) !== "needs_setup") return false;
  const client = await db();
  const res = await client.execute({
    sql: "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO NOTHING",
    args: [KEY_PASSWORD, await hashNew(password), new Date().toISOString()],
  });
  return res.rowsAffected > 0;
}

/** Replaces the password (caller must have verified the current one). Signs out other devices. */
export async function changePassword(password: string): Promise<void> {
  const client = await db();
  await client.execute({
    sql: `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    args: [KEY_PASSWORD, await hashNew(password), new Date().toISOString()],
  });
}

/* ------------------------------------------------------------------ */

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export async function createSession(): Promise<{ value: string; maxAge: number }> {
  const key = await sessionKey();
  if (!key) throw new Error("No admin password exists yet");
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const expires = String(Date.now() + maxAge * 1000);
  return { value: `${expires}.${sign(expires, key)}`, maxAge };
}

export async function isAdmin(request: NextRequest): Promise<boolean> {
  const value = request.cookies.get(SESSION_COOKIE)?.value;
  if (!value) return false;
  const [expires, signature] = value.split(".");
  if (!expires || !signature || Number(expires) <= Date.now()) return false;
  const key = await sessionKey();
  return Boolean(key) && safeEqual(signature, sign(expires, key!));
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/* ------------------------------------------------------------------ */
/* Lockout after 5 wrong passwords per IP for 10 minutes, stored in the database so it holds across  */
/* all server instances (Cloudflare runs many).                                                      */

const MAX_FAILURES = 5;
const LOCK_MS = 10 * 60 * 1000;

export async function loginLocked(ip: string): Promise<boolean> {
  const client = await db();
  const res = await client.execute({ sql: "SELECT count, until FROM login_attempts WHERE ip = ?", args: [ip] });
  const row = res.rows[0];
  return Boolean(row && Number(row.count) >= MAX_FAILURES && Number(row.until) > Date.now());
}

export async function recordLoginFailure(ip: string) {
  const client = await db();
  const now = Date.now();
  await client.execute({
    sql: `INSERT INTO login_attempts (ip, count, until) VALUES (?, 1, ?)
          ON CONFLICT(ip) DO UPDATE SET
            count = CASE WHEN until < ? THEN 1 ELSE count + 1 END,
            until = excluded.until`,
    args: [ip, now + LOCK_MS, now],
  });
}

export async function clearLoginFailures(ip: string) {
  const client = await db();
  await client.execute({ sql: "DELETE FROM login_attempts WHERE ip = ?", args: [ip] });
}

export function clientIp(request: NextRequest): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local"
  );
}
