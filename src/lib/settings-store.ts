import { db } from "./db";
import { DEFAULT_SETTINGS, validateSettings, type Settings } from "./settings";

const KEY = "shop";

/** The barber's saved settings, or the defaults from config.ts if he hasn't saved any (or they're unreadable). */
export async function getSettings(): Promise<Settings> {
  const client = await db();
  const res = await client.execute({ sql: "SELECT value FROM settings WHERE key = ?", args: [KEY] });
  const raw = res.rows[0]?.value;
  if (typeof raw !== "string") return DEFAULT_SETTINGS;
  try {
    const parsed = validateSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
    return parsed.ok ? parsed.settings : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  const client = await db();
  await client.execute({
    sql: `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    args: [KEY, JSON.stringify(settings), new Date().toISOString()],
  });
}
