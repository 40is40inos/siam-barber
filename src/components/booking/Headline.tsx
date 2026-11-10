"use client";

import { motion } from "motion/react";
import { RollText } from "@/components/RollText";

export type LineState = "filled" | "active" | "upcoming" | "accent";

const ease = [0.23, 1, 0.32, 1] as const;

const color: Record<LineState, string> = {
  filled: "text-ink",
  active: "text-ink",
  upcoming: "text-faint",
  accent: "text-accent",
};

/**
 * The three-line headline doubles as the progress indicator:
 * each line is replaced by the customer's choice as they make it.
 */
export function Headline({ lines }: { lines: { text: string; state: LineState }[] }) {
  return (
    <h1 className="font-display font-bold leading-[1.08] tracking-[-0.02em] text-[2.15rem] sm:text-[2.75rem] lg:text-[clamp(2.75rem,3.9vw,4rem)]">
      {lines.map((line, i) => (
        <span key={i} className="block overflow-hidden pb-[0.08em]">
          <motion.span
            className={`flex items-baseline gap-[0.18em] transition-colors duration-500 ${color[line.state]}`}
            initial={{ y: "110%" }}
            animate={{ y: "0%" }}
            transition={{ duration: 0.9, ease, delay: 0.15 + i * 0.08 }}
          >
            <RollText text={line.text} block className="min-w-0" />
            {line.state === "active" && <span className="caret" aria-hidden />}
          </motion.span>
        </span>
      ))}
    </h1>
  );
}
