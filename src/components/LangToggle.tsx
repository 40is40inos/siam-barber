"use client";

import { motion } from "motion/react";
import { useLang } from "@/components/LangProvider";

/** ΕΛ / EN switch, shared by the booking page and the barber's screen. */
export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="flex rounded-full bg-surface p-1 text-xs font-bold shadow-[inset_0_0_0_1px_var(--line)]" role="group" aria-label="Language">
      {(["el", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className="relative h-8 w-11 rounded-full"
        >
          {lang === l && (
            <motion.span
              layoutId="lang-pill"
              className="absolute inset-0 rounded-full bg-ink"
              transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
            />
          )}
          <span className={`relative transition-colors duration-200 ${lang === l ? "text-bg" : "text-muted"}`}>
            {l === "el" ? "ΕΛ" : "EN"}
          </span>
        </button>
      ))}
    </div>
  );
}
