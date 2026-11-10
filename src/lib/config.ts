/**
 * Everything the barber may want to change lives here.
 * Services and prices were taken from the current ebarber.gr page.
 * Opening hours are inferred from the slots ebarber offered: confirm them with the shop.
 */

export type Lang = "el" | "en";
export type Localized = Record<Lang, string>;

export type Service = {
  id: string;
  name: Localized;
  price: number; // euros
  minutes: number;
};

export const shop = {
  name: "Siam Barber",
  barber: { el: "Αλκιβιάδης Σ.", en: "Alkiviadis S." } satisfies Localized,
  /** Shown under the hours. Leave empty to hide. */
  area: { el: "", en: "" } satisfies Localized,
  /** Google Maps link for the "Directions" button. Leave empty to hide. */
  mapsUrl: "",
  timeZone: "Europe/Athens",
  currency: "€",
};

export const services: Service[] = [
  { id: "haircut", name: { el: "Κούρεμα", en: "Haircut" }, price: 10, minutes: 45 },
  { id: "design", name: { el: "Κούρεμα με Design", en: "Haircut with design" }, price: 12, minutes: 45 },
];

export const defaultServiceId = services[0].id;

/**
 * Opening hours per weekday (0 = Sunday … 6 = Saturday).
 * Each entry is an [open, close] pair; add a second pair for a lunch break.
 * A slot is offered only if it ends at or before closing time.
 */
export const openingHours: Record<number, [string, string][]> = {
  0: [],
  1: [["10:00", "20:00"]],
  2: [["10:00", "20:00"]],
  3: [["10:00", "20:00"]],
  4: [["10:00", "20:00"]],
  5: [["10:00", "20:00"]],
  6: [["09:00", "18:15"]],
};

export const booking = {
  /** Length of one appointment slot, in minutes. */
  slotMinutes: 45,
  /** How many days ahead customers can book, today included. */
  windowDays: 21,
  /** Earliest a same-day slot can be booked, in minutes from now. */
  minLeadMinutes: 30,
  /** How many upcoming appointments one phone number may hold at once. */
  maxActivePerPhone: 2,
};

export function serviceById(id: string | null | undefined): Service | undefined {
  return services.find((s) => s.id === id);
}
