"use client";

import { motion } from "motion/react";
import Link from "next/link";
import type { PublicBooking } from "@/lib/bookings";
import { shop, type Lang } from "@/lib/config";
import { googleCalendarUrl, icsPath, isAppleDevice, outlookCalendarUrl } from "@/lib/calendar";
import { longDate, price, type Dict } from "@/lib/i18n";

const ease = [0.23, 1, 0.32, 1] as const;
const RAYS = 10;

export function DoneStep({
  booking,
  onNew,
  lang,
  t,
}: {
  booking: PublicBooking;
  onNew: () => void;
  lang: Lang;
  t: Dict;
}) {
  const service = booking.serviceInfo;
  // This step only renders after a booking, in the browser, so window/navigator are available.
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const apple = isAppleDevice();
  const google = googleCalendarUrl(booking, lang, origin);
  const outlook = outlookCalendarUrl(booking, lang, origin);
  const ics = icsPath(booking.token, lang);

  return (
    <div className="flex flex-col items-center gap-7 text-center">
      <SuccessMark />

      <motion.h2
        className="font-display text-2xl font-bold tracking-tight"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease, delay: 0.45 }}
      >
        {t.booked}
      </motion.h2>

      {/* Ticket */}
      <motion.div
        className="ticket relative w-full overflow-hidden rounded-[26px] bg-ink text-left text-bg"
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", duration: 0.8, bounce: 0.22, delay: 0.55 }}
      >
        <div className="px-6 pt-5 pb-6">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-bg/55">
            <span>{shop.name}</span>
            <span className="tabular">#{booking.token.slice(0, 5).toUpperCase()}</span>
          </div>
          <div className="mt-4 font-display text-[2.9rem] leading-none font-extrabold tracking-[-0.04em] tabular min-[400px]:text-[3.6rem] sm:text-[4.25rem]">
            {booking.time}
          </div>
          <div className="mt-2 text-lg font-semibold capitalize">{longDate(booking.date, lang)}</div>
        </div>
        <div className="ticket__perf" aria-hidden />
        <div className="flex items-center justify-between gap-4 px-6 py-4 text-sm">
          <span className="font-semibold">
            {service?.name[lang]} <span className="text-bg/45">· {service ? price(service.price, lang) : ""}</span>
          </span>
          <span className="truncate text-bg/60">{booking.name}</span>
        </div>
      </motion.div>

      <motion.div
        className="flex w-full flex-col gap-3"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease, delay: 0.8 }}
      >
        {/* Apple devices open the event in Apple Calendar; everyone else in Google Calendar. */}
        <a
          href={apple ? ics : google}
          target={apple ? undefined : "_blank"}
          rel="noopener noreferrer"
          className="btn btn--primary h-13 w-full py-4"
        >
          <CalendarIcon />
          {t.addCalendar}
        </a>
        <p className="flex flex-wrap items-center justify-center gap-x-2 text-xs text-faint">
          <span>{t.otherCalendars}</span>
          <a href={google} target="_blank" rel="noopener noreferrer" className="text-muted link-draw hover:text-ink">
            Google
          </a>
          <span aria-hidden>·</span>
          <a href={ics} className="text-muted link-draw hover:text-ink">
            Apple
          </a>
          <span aria-hidden>·</span>
          <a href={outlook} target="_blank" rel="noopener noreferrer" className="text-muted link-draw hover:text-ink">
            Outlook
          </a>
        </p>
        <div className="flex items-center justify-between gap-4 px-1 pt-1 text-sm">
          <Link href={`/cancel#${booking.token}`} className="text-muted link-draw transition-colors hover:text-ink">
            {t.cancelLink}
          </Link>
          <button type="button" onClick={onNew} className="text-muted link-draw transition-colors hover:text-ink">
            {t.newBooking}
          </button>
        </div>
        <p className="pt-2 text-[0.8rem] leading-relaxed text-faint">{t.keepLink}</p>
      </motion.div>
    </div>
  );
}

function SuccessMark() {
  return (
    <div className="relative grid h-24 w-24 place-items-center">
      {Array.from({ length: RAYS }, (_, i) => {
        const angle = (i / RAYS) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full bg-accent"
            initial={{ x: 0, y: 0, opacity: 0, scale: 1 }}
            animate={{ x: Math.cos(angle) * 64, y: Math.sin(angle) * 64, opacity: [0, 1, 0], scale: 0.4 }}
            transition={{ duration: 0.8, ease, delay: 0.42 }}
            aria-hidden
          />
        );
      })}
      <motion.svg
        viewBox="0 0 96 96"
        className="h-24 w-24"
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", duration: 0.6, bounce: 0.35, delay: 0.3 }}
        aria-hidden
      >
        <motion.circle
          cx="48"
          cy="48"
          r="44"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ pathLength: 0, rotate: -90 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.55, ease }}
          style={{ originX: "50%", originY: "50%" }}
        />
        <motion.path
          d="M30 49 L43 61 L66 36"
          fill="none"
          stroke="var(--ink)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.35, ease, delay: 0.4 }}
        />
      </motion.svg>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}
