"use client";

import { AnimatePresence, motion, type Variants } from "motion/react";
import type { DayAvailability } from "@/lib/bookings";
import type { Lang } from "@/lib/config";
import { shortDate, type Dict } from "@/lib/i18n";

const ease = [0.23, 1, 0.32, 1] as const;

const list: Variants = {
  initial: (dir: number) => ({ opacity: 0, x: dir * 14 }),
  enter: { opacity: 1, x: 0, transition: { duration: 0.3, ease, staggerChildren: 0.028, delayChildren: 0.04 } },
  exit: (dir: number) => ({ opacity: 0, x: dir * -14, transition: { duration: 0.16, ease } }),
};

const chip: Variants = {
  initial: { opacity: 0, y: 12, scale: 0.96 },
  enter: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease } },
};

export function TimeGrid({
  day,
  selected,
  onSelect,
  nextFree,
  onJump,
  dir,
  lang,
  t,
}: {
  day: DayAvailability | null;
  selected: string | null;
  onSelect: (time: string) => void;
  nextFree: string | null;
  onJump: (date: string) => void;
  dir: number;
  lang: Lang;
  t: Dict;
}) {
  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t.time}</h2>
        {day && day.slots.length > 0 && <span className="text-sm text-muted">{t.free(day.slots.length)}</span>}
      </div>

      {/* Fixed minimum height (four rows) so switching days never shifts the page. */}
      <div className="relative min-h-[13.5rem]">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          {day && day.slots.length > 0 ? (
            <motion.div
              key={day.date}
              custom={dir}
              variants={list}
              initial="initial"
              animate="enter"
              exit="exit"
              className="grid grid-cols-3 gap-2 min-[380px]:grid-cols-4"
              role="radiogroup"
              aria-label={t.time}
            >
              {day.slots.map((time) => {
                const isSelected = time === selected;
                return (
                  <motion.button
                    key={time}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    variants={chip}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => onSelect(time)}
                    className="time-chip relative h-12 rounded-full text-[0.95rem] font-semibold tabular shadow-[inset_0_0_0_1px_var(--line-strong)]"
                  >
                    {isSelected && (
                      <motion.span
                        layoutId="time-pill"
                        className="absolute inset-0 rounded-full bg-accent"
                        transition={{ type: "spring", duration: 0.45, bounce: 0.2 }}
                      />
                    )}
                    <span className={`relative transition-colors duration-200 ${isSelected ? "text-accent-ink" : "text-ink"}`}>
                      {time}
                    </span>
                  </motion.button>
                );
              })}
            </motion.div>
          ) : day ? (
            <motion.div
              key={`empty-${day.date}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease }}
              className="flex min-h-[13.5rem] flex-col items-start justify-center gap-4 rounded-3xl border border-dashed border-line-strong p-6"
            >
              <p className="text-muted">
                {day.open ? t.noTimes : t.closed}
                {!day.open && day.note && <span className="text-ink"> · {day.note}</span>}
              </p>
              {nextFree ? (
                <button type="button" onClick={() => onJump(nextFree)} className="btn btn--ghost h-11 px-5 text-sm">
                  {t.nextFree}: {shortDate(nextFree, lang)}
                  <span aria-hidden>→</span>
                </button>
              ) : (
                <p className="text-sm text-faint">{t.noneInWindow}</p>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
