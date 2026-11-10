import type { NextRequest } from "next/server";
import { fail, json, readJson, requireAdmin } from "@/lib/http";
import { validateSettings } from "@/lib/settings";
import { getSettings, saveSettings } from "@/lib/settings-store";

/** The barber's services, prices, hours and booking rules. */
export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  return json({ ok: true, settings: await getSettings() });
}

export async function PUT(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const body = await readJson(request);
  const result = validateSettings(body?.settings);
  if (!result.ok) return fail(result.error);

  // Services can't be deleted outright: anything missing from the new list is kept as archived,
  // so bookings that used it still show its name.
  const current = await getSettings();
  const kept = new Set(result.settings.services.map((s) => s.id));
  const archived = current.services
    .filter((s) => !kept.has(s.id))
    .map((s) => ({ ...s, archived: true as const }));
  const settings = { ...result.settings, services: [...result.settings.services, ...archived] };

  await saveSettings(settings);
  return json({ ok: true, settings });
}
