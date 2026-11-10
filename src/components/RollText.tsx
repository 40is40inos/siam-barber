"use client";

import { AnimatePresence, motion } from "motion/react";

const ease = [0.23, 1, 0.32, 1] as const;

/**
 * Text that rolls up when its value changes: the old value leaves upward,
 * the new one rises from below. Used for values the user just chose.
 */
export function RollText({
  text,
  className = "",
  block = false,
}: {
  text: string;
  className?: string;
  block?: boolean;
}) {
  return (
    <span className={`relative overflow-hidden ${block ? "block" : "inline-flex align-bottom"} ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          className={block ? "block" : "inline-block whitespace-pre"}
          initial={{ y: "105%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: "-105%", opacity: 0 }}
          transition={{ duration: 0.5, ease }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
