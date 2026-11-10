"use client";

import { motion } from "motion/react";
import { shop, type Lang } from "@/lib/config";
import { hoursSummary } from "@/lib/hours";
import { price, type Dict } from "@/lib/i18n";
import type { PublicShop } from "@/lib/settings";

const ease = [0.23, 1, 0.32, 1] as const;

/**
 * Prices and hours. `ready` stays false until the saved settings arrive, so the page never
 * flashes the built-in defaults before the barber's own prices.
 */
export function ShopInfo({
  lang,
  t,
  info,
  ready,
  delay = 0.5,
}: {
  lang: Lang;
  t: Dict;
  info: PublicShop;
  ready: boolean;
  delay?: number;
}) {
  const blocks = [
    {
      title: t.prices,
      rows: info.services.map((s) => ({ key: s.id, left: s.name[lang], right: `${price(s.price, lang)} · ${info.slotMinutes}′` })),
    },
    {
      title: t.hours,
      rows: hoursSummary(lang, info.hours).map((h) => ({ key: h.days, left: h.days, right: h.hours })),
    },
  ];

  return (
    <div className="grid gap-8 sm:grid-cols-2" aria-hidden={!ready}>
      {blocks.map((b, i) => (
        <motion.div
          key={b.title}
          initial={{ opacity: 0, y: 14 }}
          animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
          transition={{ duration: 0.6, ease, delay: delay + i * 0.08 }}
        >
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">{b.title}</h3>
          <ul className="flex flex-col gap-2 text-[0.95rem]">
            {b.rows.map((r) => (
              <li key={r.key} className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
                <span>{r.left}</span>
                <span className="text-right text-muted tabular">
                  {/* Split shifts stack one range per line instead of overflowing. */}
                  {r.right.split(", ").map((part) => (
                    <span key={part} className="block whitespace-nowrap">
                      {part}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </motion.div>
      ))}
      <motion.p
        className="text-sm text-muted sm:col-span-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: ready ? 1 : 0 }}
        transition={{ duration: 0.6, ease, delay: delay + 0.2 }}
      >
        {t.barber}: <span className="text-ink">{shop.barber[lang]}</span>
        {shop.area[lang] && <> · {shop.area[lang]}</>}
        {shop.mapsUrl && (
          <>
            {" · "}
            <a href={shop.mapsUrl} target="_blank" rel="noreferrer" className="text-ink link-draw">
              {t.directions} ↗
            </a>
          </>
        )}
      </motion.p>
    </div>
  );
}

export function Marquee({ lang, info }: { lang: Lang; info: PublicShop }) {
  const items = [
    ...info.services.map((s) => `${s.name[lang]} ${price(s.price, lang)}`),
    ...hoursSummary(lang, info.hours).map((h) => `${h.days} ${h.hours}`),
    shop.name,
  ];
  const run = (
    <span className="flex shrink-0 items-center">
      {items.map((it, i) => (
        <span key={i} className="flex items-center whitespace-nowrap">
          <span className="px-5">{it}</span>
          <span className="h-1 w-1 rounded-full bg-accent" aria-hidden />
        </span>
      ))}
    </span>
  );
  return (
    <div className="marquee overflow-hidden border-y border-line py-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted" aria-hidden>
      <div className="marquee__track">
        {run}
        {run}
      </div>
    </div>
  );
}
