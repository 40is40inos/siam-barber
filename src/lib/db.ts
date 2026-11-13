import { createClient, type Client } from "@libsql/client";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * Local development uses a SQLite file (data/siam-barber.db).
 * In production set DATABASE_URL (libsql://… from Turso, or file:/path/on/a/persistent/disk)
 * and DATABASE_AUTH_TOKEN when the database is remote.
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS appointments (
  id           TEXT PRIMARY KEY,
  token        TEXT NOT NULL UNIQUE,
  date         TEXT NOT NULL,
  time         TEXT NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'booking',
  service      TEXT,
  name         TEXT,
  phone        TEXT,
  source       TEXT NOT NULL DEFAULT 'online',
  status       TEXT NOT NULL DEFAULT 'active',
  created_at   TEXT NOT NULL,
  cancelled_at TEXT,
  cancelled_by TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS appointments_one_per_slot
  ON appointments(date, time) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS appointments_by_phone
  ON appointments(phone) WHERE status = 'active';
CREATE TABLE IF NOT EXISTS closed_days (
  date       TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

/**
 * Columns added after the first release. Each runs once; "duplicate column" means it's already there.
 * - appointments.minutes: length of that booking, so changing the slot length never double-books.
 * - closed_days.note: optional reason shown to customers ("Χριστούγεννα").
 * - appointments.note: optional note from the customer or the barber ("μόνο ψαλίδι").
 */
const MIGRATIONS = [
  "ALTER TABLE appointments ADD COLUMN minutes INTEGER",
  "ALTER TABLE closed_days ADD COLUMN note TEXT",
  "ALTER TABLE appointments ADD COLUMN note TEXT",
];

/** Length assumed for bookings made before appointments.minutes existed. */
export const LEGACY_MINUTES = 45;

const globalForDb = globalThis as unknown as { __siamDb?: Promise<Client>; __siamSchemaReady?: boolean };

/** True inside Cloudflare Workers (deployed via OpenNext), where there is no disk and no shared sockets. */
const onWorkers = () => typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

function databaseUrl(): string {
  const url = process.env.DATABASE_URL || "file:data/siam-barber.db";
  if (onWorkers() && url.startsWith("file:")) {
    throw new Error(
      "DATABASE_URL is not set: on Cloudflare Workers it must point to a Turso/libsql database (libsql://…), " +
        "with DATABASE_AUTH_TOKEN as a secret.",
    );
  }
  return url;
}

/** Creates tables and applies migrations; runs once per server instance. */
async function ensureSchema(client: Client) {
  if (globalForDb.__siamSchemaReady) return;
  await client.executeMultiple(SCHEMA);
  for (const sql of MIGRATIONS) {
    try {
      await client.execute(sql);
    } catch (err) {
      if (!String((err as Error)?.message).includes("duplicate column")) throw err;
    }
  }
  globalForDb.__siamSchemaReady = true;
}

async function connect(): Promise<Client> {
  const url = databaseUrl();
  if (url.startsWith("file:")) {
    mkdirSync(path.dirname(path.resolve(url.slice("file:".length))), { recursive: true });
  }
  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
  await ensureSchema(client);
  return client;
}

export function db(): Promise<Client> {
  // Workers must not reuse I/O objects across requests: a fresh HTTP client per call is cheap.
  if (onWorkers()) return connect();
  globalForDb.__siamDb ??= connect().catch((err) => {
    globalForDb.__siamDb = undefined;
    throw err;
  });
  return globalForDb.__siamDb;
}

export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return (
    (typeof e?.code === "string" && e.code.startsWith("SQLITE_CONSTRAINT")) ||
    (typeof e?.message === "string" && e.message.includes("UNIQUE constraint failed"))
  );
}
