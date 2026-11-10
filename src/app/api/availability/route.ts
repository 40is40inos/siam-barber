import { connection } from "next/server";
import { getAvailability } from "@/lib/bookings";
import { json } from "@/lib/http";
import { toPublicShop } from "@/lib/settings";

export async function GET() {
  await connection();
  const { today, days, settings } = await getAvailability();
  return json({ today, days, shop: toPublicShop(settings) });
}
