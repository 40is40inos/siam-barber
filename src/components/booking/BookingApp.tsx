"use client";

import { AnimatePresence, MotionConfig, motion, type Variants } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Ambient, BrandMark } from "@/components/BrandMark";
import { useLang } from "@/components/LangProvider";
import { LangToggle } from "@/components/LangToggle";
import type { DayAvailability, PublicBooking } from "@/lib/bookings";
import type { Lang } from "@/lib/config";
import { fmtDate, shortDate } from "@/lib/i18n";
import { DEFAULT_SETTINGS, toPublicShop, type PublicShop } from "@/lib/settings";
import { KEYS, readJSON, writeJSON } from "@/lib/storage";
import { DayGrid } from "./DayGrid";
import { DetailsStep } from "./DetailsStep";
import { DoneStep } from "./DoneStep";
import { Headline, type LineState } from "./Headline";
import { Marquee, ShopInfo } from "./ShopInfo";
import { TimeGrid } from "./TimeGrid";

type Availability = { today: string; days: DayAvailability[]; shop: PublicShop };

/** Shown (invisibly) until the saved settings arrive, so the layout doesn't jump. */
const FALLBACK_SHOP = toPublicShop(DEFAULT_SETTINGS);
type Step = "when" | "details" | "done";

const ORDER: Record<Step, number> = { when: 0, details: 1, done: 2 };
const ease = [0.23, 1, 0.32, 1] as const;

const stepVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 36, scale: 0.985 }),
  center: { opacity: 1, x: 0, scale: 1, transition: { duration: 0.45, ease } },
  exit: (dir: number) => ({ opacity: 0, x: dir * -36, scale: 0.985, transition: { duration: 0.2, ease } }),
};

async function fetchAvailability(): Promise<Availability> {
  const res = await fetch("/api/availability", { cache: "no-store" });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as Availability;
}

function headlineDate(date: string, lang: Lang) {
  return fmtDate(date, lang, { weekday: "long", day: "numeric", month: "short" }).replace(/[.,]/g, "");
}

export function BookingApp() {
  const { lang, t } = useLang();
  const [avail, setAvail] = useState<Availability | null>(null);
  const [failed, setFailed] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [dayDir, setDayDir] = useState(1);
  const [step, setStep] = useState<Step>("when");
  const [stepDir, setStepDir] = useState(1);
  const [service, setService] = useState<string | null>(null);
  const [booked, setBooked] = useState<PublicBooking | null>(null);
  const [upcoming, setUpcoming] = useState<PublicBooking[]>([]);
  const userPickedDay = useRef(false);
  const advanceTimer = useRef<number | undefined>(undefined);
  const panelRef = useRef<HTMLDivElement>(null);

  const apply = useCallback((data: Availability) => {
    setAvail(data);
    setFailed(false);
    setDate((prev) => {
      const still = data.days.find((d) => d.date === prev);
      if (prev && still && (userPickedDay.current || still.slots.length > 0)) return prev;
      return (data.days.find((d) => d.slots.length > 0) ?? data.days.find((d) => d.open) ?? data.days[0])?.date ?? null;
    });
  }, []);

  const load = useCallback(() => {
    fetchAvailability()
      .then(apply)
      .catch(() => setFailed(true));
  }, [apply]);

  // First load, then keep times fresh while the customer is choosing.
  useEffect(() => {
    fetchAvailability()
      .then(apply)
      .catch(() => setFailed(true));
  }, [apply]);

  useEffect(() => {
    if (step !== "when") return;
    const id = window.setInterval(load, 60_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [step, load]);

  // Appointments this device booked before, so returning customers can find or cancel them.
  // Next keeps this page alive (hidden) while the customer is on /cancel and re-runs this effect
  // on return, so it must also clear the list when nothing is left; no early return here.
  useEffect(() => {
    const tokens = readJSON<string[]>(KEYS.bookings, []);
    let alive = true;
    Promise.all(
      tokens.map(async (token) => {
        try {
          const res = await fetch(`/api/bookings/${encodeURIComponent(token)}`, { cache: "no-store" });
          if (res.status === 404) return { token, booking: null, gone: true };
          const data = await res.json();
          const b = data.booking as PublicBooking;
          return { token, booking: b, gone: b.status !== "active" || b.started };
        } catch {
          return { token, booking: null, gone: false };
        }
      }),
    ).then((results) => {
      if (!alive) return;
      writeJSON(KEYS.bookings, results.filter((r) => !r.gone).map((r) => r.token));
      setUpcoming(results.filter((r) => r.booking && !r.gone).map((r) => r.booking as PublicBooking));
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => () => window.clearTimeout(advanceTimer.current), []);

  // Leaving the page from the confirmation (e.g. via its cancel link) starts over on return,
  // instead of showing a ticket that may have been cancelled meanwhile.
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  useLayoutEffect(
    () => () => {
      if (stepRef.current !== "done") return;
      setBooked(null);
      setTime(null);
      setStep("when");
      userPickedDay.current = false;
    },
    [],
  );

  const go = useCallback(
    (next: Step) => {
      setStepDir(ORDER[next] >= ORDER[step] ? 1 : -1);
      setStep(next);
      // On phones the panel can be scrolled half out of view: bring its top back.
      const top = panelRef.current?.getBoundingClientRect().top ?? 0;
      if (top < 0) {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: window.scrollY + top - 16, behavior: reduce ? "auto" : "smooth" });
      }
    },
    [step],
  );

  const shopInfo = avail?.shop ?? FALLBACK_SHOP;
  // Keep the chosen service valid if the barber changed the menu.
  const serviceId = shopInfo.services.some((s) => s.id === service) ? service! : shopInfo.services[0]?.id;

  const selectedDay = avail?.days.find((d) => d.date === date) ?? null;
  const nextFree =
    avail && date ? (avail.days.find((d) => d.date > date && d.slots.length > 0)?.date ?? null) : null;

  function pickDate(d: string) {
    if (d === date) return;
    userPickedDay.current = true;
    setDayDir(date && d < date ? -1 : 1);
    setDate(d);
    setTime(null);
  }

  function pickTime(tm: string) {
    setTime(tm);
    window.clearTimeout(advanceTimer.current);
    // Let the selection land visibly before moving on.
    advanceTimer.current = window.setTimeout(() => go("details"), 360);
  }

  function back() {
    if (time && selectedDay && !selectedDay.slots.includes(time)) setTime(null);
    go("when");
  }

  function onBooked(b: PublicBooking) {
    setBooked(b);
    const tokens = readJSON<string[]>(KEYS.bookings, []);
    writeJSON(KEYS.bookings, [...tokens.filter((x) => x !== b.token), b.token].slice(-5));
    setUpcoming((prev) => [...prev.filter((x) => x.token !== b.token), b]);
    go("done");
    load();
  }

  function startOver() {
    setBooked(null);
    setTime(null);
    userPickedDay.current = false;
    go("when");
    load();
  }

  const lines: { text: string; state: LineState }[] = [
    { text: date ? headlineDate(date, lang) : t.lineDay, state: date ? "filled" : "active" },
    { text: time ? `${t.at} ${time}` : t.lineTime, state: time ? "filled" : date ? "active" : "upcoming" },
    {
      text: step === "done" ? t.seeYou : t.lineName,
      state: step === "done" ? "accent" : step === "details" ? "active" : "upcoming",
    },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <Ambient />
      <div className="relative z-10 mx-auto grid min-h-dvh max-w-[1400px] grid-cols-1 px-4 sm:px-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-x-16 lg:px-12">
        {/* Left: brand, live headline, shop info */}
        <section className="flex flex-col pt-5 lg:sticky lg:top-0 lg:h-dvh lg:py-8">
          <motion.header
            className="flex items-center justify-between"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
          >
            <BrandMark />
            <LangToggle />
          </motion.header>

          <div className="pt-9 pb-7 sm:pt-12 lg:flex lg:flex-1 lg:flex-col lg:justify-center lg:py-0">
            <Headline lines={lines} />
            <div className="mt-14 hidden lg:block">
              <ShopInfo lang={lang} t={t} info={shopInfo} ready={Boolean(avail)} />
            </div>
          </div>

          <div className="hidden lg:block">
            <Marquee lang={lang} info={shopInfo} />
          </div>
        </section>

        {/* Right: the booking panel */}
        <section className="pb-10 lg:flex lg:min-h-dvh lg:items-center lg:py-10">
          <motion.div
            ref={panelRef}
            className="w-full rounded-[32px] bg-surface p-5 shadow-[inset_0_0_0_1px_var(--line),0_40px_120px_-40px_rgb(0_0_0/0.8)] sm:p-8"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease, delay: 0.3 }}
          >
            <AnimatePresence initial={false}>
              {step === "when" && upcoming.length > 0 && (
                <motion.div
                  key="upcoming"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease }}
                  className="overflow-hidden"
                >
                  <div className="mb-6 flex flex-col gap-2">
                    {upcoming.map((b) => (
                      <Link
                        key={b.token}
                        href={`/cancel#${b.token}`}
                        className="group flex items-center justify-between gap-3 rounded-2xl bg-accent/10 px-4 py-3 text-sm shadow-[inset_0_0_0_1px_rgb(255_91_53/0.3)] transition-colors duration-200 hover:bg-accent/15"
                      >
                        <span className="min-w-0">
                          <span className="block text-xs text-muted">{t.yourBooking}</span>
                          <span className="block truncate font-semibold capitalize">
                            {shortDate(b.date, lang)} · {b.time}
                          </span>
                        </span>
                        <span className="whitespace-nowrap text-muted transition-colors group-hover:text-ink">
                          {t.cancelShort} →
                        </span>
                      </Link>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait" custom={stepDir} initial={false}>
              <motion.div key={step} custom={stepDir} variants={stepVariants} initial="enter" animate="center" exit="exit">
                {step === "when" &&
                  (avail ? (
                    <div className="flex flex-col gap-9">
                      <DayGrid days={avail.days} today={avail.today} selected={date} onSelect={pickDate} lang={lang} t={t} />
                      <TimeGrid
                        day={selectedDay}
                        selected={time}
                        onSelect={pickTime}
                        nextFree={nextFree}
                        onJump={pickDate}
                        dir={dayDir}
                        lang={lang}
                        t={t}
                      />
                    </div>
                  ) : failed ? (
                    <div className="flex min-h-[30rem] flex-col items-center justify-center gap-4 text-center">
                      <p className="text-muted">{t.loadError}</p>
                      <button type="button" onClick={load} className="btn btn--ghost h-11 px-5 text-sm">
                        {t.retry}
                      </button>
                    </div>
                  ) : (
                    <LoadingGrid label={t.loading} />
                  ))}

                {step === "details" && date && time && (
                  <DetailsStep
                    date={date}
                    time={time}
                    services={shopInfo.services}
                    slotMinutes={shopInfo.slotMinutes}
                    service={serviceId}
                    onService={setService}
                    onBack={back}
                    onBooked={onBooked}
                    onSlotGone={load}
                    lang={lang}
                    t={t}
                  />
                )}

                {step === "done" && booked && <DoneStep booking={booked} onNew={startOver} lang={lang} t={t} />}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </section>

        <section className="flex flex-col gap-10 pb-8 lg:hidden">
          <ShopInfo lang={lang} t={t} info={shopInfo} ready={Boolean(avail)} delay={0.6} />
          <Marquee lang={lang} info={shopInfo} />
        </section>
      </div>
    </MotionConfig>
  );
}

function LoadingGrid({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-9" aria-busy="true" aria-label={label}>
      <div>
        <div className="mb-4 h-3 w-16 rounded-full bg-surface-2" />
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {Array.from({ length: 28 }, (_, i) => (
            <div key={i} className="skeleton aspect-square rounded-2xl" style={{ animationDelay: `${(i % 7) * 60}ms` }} />
          ))}
        </div>
      </div>
      <div>
        <div className="mb-4 h-3 w-12 rounded-full bg-surface-2" />
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="skeleton h-12 rounded-full" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
