import type { Lang } from "./config";
import { dict } from "./i18n";
import type { WeekHours } from "./settings";

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first

/** Groups consecutive weekdays with identical hours: "Δευ – Παρ · 10:00–20:00". */
export function hoursSummary(lang: Lang, hours: WeekHours): { days: string; hours: string }[] {
  const names = dict[lang].weekdaysShort;
  const key = (d: number) => (hours[d] ?? []).map(([a, b]) => `${a}–${b}`).join(", ");
  const groups: { from: number; to: number; hours: string }[] = [];
  ORDER.forEach((d, i) => {
    const h = key(d);
    const last = groups.at(-1);
    if (last && last.hours === h) last.to = i;
    else groups.push({ from: i, to: i, hours: h });
  });
  return groups.map((g) => ({
    days: g.from === g.to ? names[g.from] : `${names[g.from]} – ${names[g.to]}`,
    hours: g.hours || dict[lang].closed,
  }));
}
