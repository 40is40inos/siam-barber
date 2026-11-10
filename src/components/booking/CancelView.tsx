"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Ambient, BrandMark } from "@/components/BrandMark";
import { useLang } from "@/components/LangProvider";
import type { PublicBooking } from "@/lib/bookings";
import { longDate, price } from "@/lib/i18n";
import { KEYS, readJSON, writeJSON } from "@/lib/storage";

const ease = [0.23, 1, 0.32, 1] as const;

type State =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "ready"; booking: PublicBooking }
  | { kind: "cancelling"; booking: PublicBooking }
  | { kind: "cancelled"; booking: PublicBooking }
  | { kind: "error"; booking: PublicBooking };

function forget(token: string) {
  writeJSON(
    KEYS.bookings,
    readJSON<string[]>(KEYS.bookings, []).filter((t) => t !== token),
  );
}

export function CancelView() {
  const { lang, t } = useLang();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const token = decodeURIComponent(window.location.hash.slice(1));
    const request = token
      ? fetch(`/api/bookings/${encodeURIComponent(token)}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null))
      : Promise.resolve(null);
    request
      .then((data) => setState(data?.booking ? { kind: "ready", booking: data.booking } : { kind: "missing" }))
      .catch(() => setState({ kind: "missing" }));
  }, []);

  async function cancel(booking: PublicBooking) {
    setState({ kind: "cancelling", booking });
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(booking.token)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      forget(booking.token);
      setState({ kind: "cancelled", booking: { ...booking, status: "cancelled" } });
    } catch {
      setState({ kind: "error", booking });
    }
  }

  const booking = "booking" in state ? state.booking : null;
  const service = booking?.serviceInfo ?? null;

  return (
    <MotionConfig reducedMotion="user">
      <Ambient />
      <main className="relative z-10 mx-auto flex min-h-dvh max-w-lg flex-col px-4 py-5 sm:px-6">
        <header>
          <Link href="/" aria-label="Siam Barber">
            <BrandMark />
          </Link>
        </header>

        <div className="flex flex-1 items-center py-10">
          <motion.div
            className="w-full rounded-[32px] bg-surface p-6 shadow-[inset_0_0_0_1px_var(--line)] sm:p-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={state.kind === "cancelling" ? "ready" : state.kind}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease }}
                className="flex flex-col gap-6"
              >
                {state.kind === "loading" && <div className="skeleton h-40 rounded-3xl" />}

                {state.kind === "missing" && (
                  <>
                    <h1 className="font-display text-2xl font-bold">{t.notFound}</h1>
                    <Link href="/" className="btn btn--primary h-12 w-full">
                      {t.backHome}
                    </Link>
                  </>
                )}

                {booking && state.kind !== "missing" && state.kind !== "loading" && (
                  <>
                    <h1 className="font-display text-2xl font-bold tracking-tight">
                      {state.kind === "cancelled" ? t.cancelled : t.cancelTitle}
                    </h1>

                    <div className={`rounded-3xl bg-bg/60 p-5 transition-opacity duration-300 ${state.kind === "cancelled" || booking.status === "cancelled" ? "opacity-50" : ""}`}>
                      <div className={`font-display text-5xl font-extrabold tracking-tight tabular ${state.kind === "cancelled" || booking.status === "cancelled" ? "line-through decoration-accent decoration-4" : ""}`}>
                        {booking.time}
                      </div>
                      <div className="mt-2 text-lg font-semibold capitalize">{longDate(booking.date, lang)}</div>
                      <div className="mt-1 text-sm text-muted">
                        {service?.name[lang]}
                        {service && ` · ${price(service.price, lang)}`}
                        {booking.name && ` · ${booking.name}`}
                      </div>
                    </div>

                    {state.kind === "cancelled" ? (
                      <>
                        <p className="text-muted">{t.cancelledHint}</p>
                        <Link href="/" className="btn btn--primary h-12 w-full">
                          {t.backHome}
                        </Link>
                      </>
                    ) : booking.status === "cancelled" ? (
                      <>
                        <p className="text-muted">{t.alreadyCancelled}</p>
                        <Link href="/" className="btn btn--primary h-12 w-full">
                          {t.backHome}
                        </Link>
                      </>
                    ) : booking.started ? (
                      <p className="text-muted">{t.cantCancelStarted}</p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {state.kind === "error" && (
                          <p className="text-sm text-accent" role="alert">
                            {t.errors.generic}
                          </p>
                        )}
                        <button
                          type="button"
                          disabled={state.kind === "cancelling"}
                          onClick={() => cancel(booking)}
                          className="btn h-12 w-full bg-accent text-accent-ink disabled:opacity-60"
                        >
                          {state.kind === "cancelling" ? (
                            <>
                              <span className="spinner" aria-hidden />
                              {t.cancelling}
                            </>
                          ) : (
                            t.cancelConfirm
                          )}
                        </button>
                        <Link href="/" className="btn btn--ghost h-12 w-full">
                          {t.keep}
                        </Link>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </main>
    </MotionConfig>
  );
}
