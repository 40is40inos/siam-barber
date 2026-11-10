"use client";

import { motion } from "motion/react";
import type { DayAvailability } from "@/lib/bookings";
import type { Lang } from "@/lib/config";
import { fmtDate, monthName, type Dict } from "@/lib/i18n";
import { addDays, weekday } from "@/lib/time";

const ease = [0.23, 1, 0.32, 1] as const;

export function DayGrid({
  days,
  today,
  selected,
  onSelect,
  lang,
  t,
}: {
  days: DayAvailability[];
  today: string;
  selected: string | null;
  onSelect: (date: string) => void;
  lang: Lang;
  t: Dict;
}) {
  const lead = (weekday(days[0].date) + 6) % 7; // Monday-first offset
  const first = monthName(days[0].date, lang);
  const last = monthName(days[days.length - 1].date, lang);
  const tomorrow = addDays(today, 1);

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t.day}</h2>
        <span className="text-sm text-muted capitalize">{first === last ? first : `${first} – ${last}`}</span>
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2" role="radiogroup" aria-label={t.day}>
        {t.weekdaysShort.map((w) => (
          <div key={w} className="pb-1 text-center text-[0.7rem] font-medium uppercase tracking-wider text-faint">
            {w}
          </div>
        ))}

        {Array.from({ length: lead }, (_, i) => (
          <div key={`lead-${i}`} aria-hidden />
        ))}

        {days.map((day, i) => {
          const isSelected = day.date === selected;
          const bookable = day.slots.length > 0;
          // A holiday with a note stays tappable so the customer can read why it's closed.
          const tappable = bookable || Boolean(day.note);
          const dayNum = Number(day.date.slice(8));
          const label =
            day.date === today ? t.today : day.date === tomorrow ? t.tomorrow : fmtDate(day.date, lang, { weekday: "long", day: "numeric", month: "long" });
          const status = !day.open ? (day.note ? `${t.closed}, ${day.note}` : t.closed) : bookable ? t.free(day.slots.length) : t.full;

          return (
            <motion.button
              key={day.date}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${label}, ${status}`}
              disabled={!tappable}
              onClick={() => onSelect(day.date)}
              initial={{ opacity: 0, y: 10, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, ease, delay: 0.1 + i * 0.018 }}
              whileTap={tappable ? { scale: 0.92 } : undefined}
              className={`day-cell group relative flex aspect-square flex-col items-center justify-center rounded-2xl text-[0.95rem] font-semibold tabular sm:text-base ${
                bookable ? "cursor-pointer text-ink" : tappable ? "cursor-pointer text-faint" : "cursor-default text-faint"
              }`}
            >
              {isSelected && (
                <motion.span
                  layoutId="day-pill"
                  className="absolute inset-0 rounded-2xl bg-ink"
                  transition={{ type: "spring", duration: 0.5, bounce: 0.18 }}
                />
              )}
              {dayNum === 1 && (
                <span className={`relative -mb-0.5 text-[0.6rem] uppercase tracking-wider ${isSelected ? "text-bg/70" : "text-muted"}`}>
                  {fmtDate(day.date, lang, { month: "short" }).replace(".", "")}
                </span>
              )}
              <span
                className={`relative transition-colors duration-200 ${isSelected ? "text-bg" : ""} ${
                  day.open && !bookable ? "line-through decoration-faint" : ""
                }`}
              >
                {dayNum}
              </span>
              <span
                className={`relative mt-1 h-1 w-1 rounded-full transition-colors duration-200 ${
                  bookable ? (isSelected ? "bg-accent" : day.date === today ? "bg-ink" : "bg-accent/80") : "bg-transparent"
                }`}
                aria-hidden
              />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
