"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { useLang } from "@/components/LangProvider";
import { LangToggle } from "@/components/LangToggle";
import { adminDict } from "@/lib/admin-i18n";
import type { AdminSlot } from "@/lib/bookings";
import { fmtDate, longDate, price } from "@/lib/i18n";
import { activeServices, findService, type Settings } from "@/lib/settings";
import { formatPhone } from "@/lib/validate";
import { AdminSettings } from "./AdminSettings";

/* The barber's screen is used many times a day: motion here is quick and quiet. */

const ease = [0.23, 1, 0.32, 1] as const;

type StripDay = { date: string; booked: number; capacity: number; closed: boolean; closedByBarber: boolean };
type Day = { date: string; closed: boolean; note: string | null; slots: AdminSlot[] };

function useAdminText() {
  const { lang } = useLang();
  return { lang, a: adminDict[lang] };
}

async function call(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    cache: "no-store",
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export function AdminApp() {
  const [session, setSession] = useState<"checking" | "out" | "in" | "unconfigured">("checking");

  useEffect(() => {
    call("/api/admin/session").then(({ data }) =>
      setSession(data.signedIn ? "in" : data.configured === false ? "unconfigured" : "out"),
    );
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-dvh bg-bg">
        {session === "checking" ? null : session === "in" ? (
          <Dashboard onSignedOut={() => setSession("out")} />
        ) : (
          <Login unconfigured={session === "unconfigured"} onSignedIn={() => setSession("in")} />
        )}
      </div>
    </MotionConfig>
  );
}

/* ------------------------------------------------------------------ */

function Login({ onSignedIn, unconfigured }: { onSignedIn: () => void; unconfigured: boolean }) {
  const { a } = useAdminText();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null); // error code, translated at render
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const { ok, data } = await call("/api/admin/session", { method: "POST", body: JSON.stringify({ password }) });
    setBusy(false);
    if (ok) return onSignedIn();
    setError(data.error === "locked" || data.error === "not_configured" ? data.error : "wrong_password");
  }

  return (
    <div className="relative grid min-h-dvh place-items-center px-4">
      <div className="absolute top-5 right-4 sm:right-6">
        <LangToggle />
      </div>
      <motion.form
        onSubmit={submit}
        className="w-full max-w-sm rounded-[28px] bg-surface p-7 shadow-[inset_0_0_0_1px_var(--line)]"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease }}
      >
        <BrandMark />
        <h1 className="mt-8 font-display text-2xl font-bold tracking-tight">{a.title}</h1>
        <p className="mt-1 text-sm text-muted">{a.subtitle}</p>
        {unconfigured ? (
          <p className="mt-6 rounded-2xl bg-accent/10 p-4 text-sm">{a.notConfiguredHelp}</p>
        ) : (
          <>
            <div className="field mt-6" data-invalid={Boolean(error)}>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder=" "
                autoComplete="current-password"
                autoFocus
              />
              <label htmlFor="admin-password">{a.password}</label>
              <span className="field__bar" aria-hidden />
            </div>
            {error && (
              <p className="mt-3 text-sm text-accent" role="alert">
                {a.loginErrors[error]}
              </p>
            )}
            <button type="submit" disabled={busy || !password} className="btn btn--primary mt-7 h-12 w-full disabled:opacity-50">
              {busy ? <span className="spinner" aria-hidden /> : a.signIn}
            </button>
          </>
        )}
      </motion.form>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Dashboard({ onSignedOut }: { onSignedOut: () => void }) {
  const { lang, a } = useAdminText();
  const [today, setToday] = useState<string | null>(null);
  const [strip, setStrip] = useState<StripDay[]>([]);
  const [month, setMonth] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const pickRef = useRef<"first" | "last" | "auto" | null>(null);
  const [day, setDay] = useState<Day | null>(null);
  const [toast, setToast] = useState<string | null>(null); // toast code (translated at render) or ready text
  const [tab, setTab] = useState<"schedule" | "settings">("schedule");
  const [settings, setSettings] = useState<Settings | null>(null);

  const handle401 = useCallback(
    (status: number) => {
      if (status === 401) onSignedOut();
      return status === 401;
    },
    [onSignedOut],
  );

  type Res = Awaited<ReturnType<typeof call>>;
  const offline = useCallback(() => setToast("offline"), []);

  const applyStrip = useCallback(
    (res: Res) => {
      if (handle401(res.status) || !res.ok) return;
      const { today: t, month: m, days } = res.data as { today: string; month: string; days: StripDay[] };
      const pick = pickRef.current;
      pickRef.current = null;
      setToday(t);
      setMonth(m);
      setStrip(days);
      setSelected((s) => {
        if (pick === "first") return `${m}-01`;
        if (pick === "last") return days.filter((d) => d.date.startsWith(m)).at(-1)?.date ?? `${m}-01`;
        if (s && days.some((d) => d.date === s)) return s;
        return t.startsWith(m) ? t : `${m}-01`;
      });
    },
    [handle401],
  );

  /** Opens another month; `pick` chooses which of its days gets selected. */
  const goMonth = useCallback(
    (m: string, pick: "first" | "last" | "auto" = "auto") => {
      pickRef.current = pick;
      if (pick === "auto") setSelected(null);
      call(`/api/admin/strip?month=${m}`).then(applyStrip).catch(offline);
    },
    [applyStrip, offline],
  );

  const applyDay = useCallback(
    (res: Res) => {
      if (handle401(res.status) || !res.ok) return;
      setDay(res.data.day);
    },
    [handle401],
  );

  const refresh = useCallback(() => {
    call(`/api/admin/strip${month ? `?month=${month}` : ""}`).then(applyStrip).catch(offline);
    if (selected) call(`/api/admin/day?date=${selected}`).then(applyDay).catch(offline);
  }, [applyStrip, applyDay, offline, selected, month]);

  useEffect(() => {
    call("/api/admin/strip").then(applyStrip).catch(offline);
  }, [applyStrip, offline]);

  useEffect(() => {
    call("/api/admin/settings")
      .then((res) => {
        if (!handle401(res.status) && res.ok) setSettings(res.data.settings);
      })
      .catch(offline);
  }, [handle401, offline]);

  useEffect(() => {
    if (!selected) return;
    call(`/api/admin/day?date=${selected}`).then(applyDay).catch(offline);
  }, [selected, applyDay, offline]);

  useEffect(() => {
    const id = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  async function mutate(path: string, init: RequestInit, okToast?: string) {
    const res = await call(path, init);
    if (handle401(res.status)) return false;
    if (!res.ok) {
      const code = res.data.error;
      setToast(["taken", "invalid_phone", "invalid_name", "invalid_note"].includes(code) ? code : "generic");
    } else if (okToast) setToast(okToast);
    refresh();
    return res.ok;
  }

  async function signOut() {
    await call("/api/admin/session", { method: "DELETE" });
    onSignedOut();
  }

  const stripDay = strip.find((d) => d.date === selected);
  const booked = day?.slots.filter((s) => s.appointment?.kind === "booking").length ?? 0;
  const free = day?.slots.filter((s) => !s.appointment && !s.started && s.inSchedule).length ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
      <header className="flex items-center justify-between gap-3 py-5">
        <BrandMark />
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link href="/" className="btn btn--ghost hidden h-9 px-4 text-sm sm:inline-flex">
            {a.bookingPage}
          </Link>
          <LangToggle />
          <button type="button" onClick={signOut} className="btn btn--ghost h-9 whitespace-nowrap px-3 text-sm sm:px-4">
            {a.signOut}
          </button>
        </div>
      </header>

      <div className="mb-5 flex w-fit rounded-full bg-surface p-1 text-sm font-semibold shadow-[inset_0_0_0_1px_var(--line)]" role="tablist">
        {(["schedule", "settings"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className="relative h-9 rounded-full px-4"
          >
            {tab === k && (
              <motion.span
                layoutId="admin-tab"
                className="absolute inset-0 rounded-full bg-ink"
                transition={{ type: "spring", duration: 0.35, bounce: 0.12 }}
              />
            )}
            <span className={`relative transition-colors duration-150 ${tab === k ? "text-bg" : "text-muted"}`}>
              {k === "schedule" ? a.tabSchedule : a.tabSettings}
            </span>
          </button>
        ))}
      </div>

      {/* Both tabs stay mounted so unsaved settings survive switching back and forth. */}
      <div hidden={tab !== "settings"}>
        {settings ? (
          <AdminSettings
            settings={settings}
            today={today}
            onSaved={(s) => {
              setSettings(s);
              refresh();
            }}
            onToast={setToast}
            onUnauthorized={onSignedOut}
          />
        ) : (
          <p className="text-muted">{a.loading}</p>
        )}
      </div>

      <div hidden={tab !== "schedule"}>
      {month && (
        <MonthWeeks month={month} days={strip} today={today} selected={selected} onSelect={setSelected} onMonth={goMonth} />
      )}

      {selected && (
        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-[1.9rem] leading-tight font-bold tracking-tight capitalize">
                {selected === today ? a.today : longDate(selected, lang)}
              </h1>
              <p className="mt-1 text-sm text-muted">
                {selected === today && <span className="capitalize">{longDate(selected, lang)} · </span>}
                {stripDay?.closed && !stripDay.closedByBarber ? a.closedBySchedule : a.summary(booked, free)}
              </p>
            </div>
            {day && day.slots.some((s) => s.inSchedule) && (
              <button
                type="button"
                onClick={() =>
                  mutate(
                    "/api/admin/days",
                    { method: "PUT", body: JSON.stringify({ date: selected, closed: !day.closed }) },
                    day.closed ? "dayOpened" : "dayClosed",
                  )
                }
                className={`btn h-10 px-4 text-sm ${day.closed ? "btn--primary" : "btn--ghost"}`}
              >
                {day.closed ? a.openDay : a.closeDay}
              </button>
            )}
          </div>

          {day?.closed && (
            <p className="mt-4 rounded-2xl bg-accent/10 px-4 py-3 text-sm shadow-[inset_0_0_0_1px_rgb(255_91_53/0.3)]">
              {day.note && <span className="font-semibold">{day.note} · </span>}
              {a.dayClosedNote}
              {booked > 0 && a.dayClosedKeep}
            </p>
          )}

          <AnimatePresence mode="wait" initial={false}>
            {day && day.date === selected && (
              <motion.ul
                key={day.date}
                className="mt-6 flex flex-col gap-2"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.2, ease }}
              >
                {day.slots.length === 0 && (
                  <li className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-muted">{a.closedAllDay}</li>
                )}
                {day.slots.length > 0 && day.slots.every((s) => s.started && !s.appointment) && (
                  <li className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-muted">{a.noneLeft}</li>
                )}
                {/* Past slots that stayed empty are noise: only show past ones that had someone. */}
                {day.slots
                  .filter((s) => !(s.started && !s.appointment))
                  .map((slot) => (
                    <SlotRow
                      key={slot.time}
                      date={day.date}
                      slot={slot}
                      closedDay={day.closed}
                      settings={settings}
                      mutate={mutate}
                    />
                  ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </section>
      )}
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast}
            className="fixed inset-x-0 top-5 z-50 mx-auto w-fit max-w-[calc(100%-2rem)] rounded-full bg-ink px-5 py-3 text-center text-sm font-semibold text-bg shadow-2xl"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.2, ease }}
            role="status"
          >
            {a.toasts[toast] ?? toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
}

/** Month header with prev/next, then that month's weeks in a horizontal pager (swipe or arrows). */
function MonthWeeks({
  month,
  days,
  today,
  selected,
  onSelect,
  onMonth,
}: {
  month: string;
  days: StripDay[];
  today: string | null;
  selected: string | null;
  onSelect: (d: string) => void;
  onMonth: (m: string, pick?: "first" | "last" | "auto") => void;
}) {
  const { lang, a } = useAdminText();
  const pager = useRef<HTMLDivElement>(null);
  const [week, setWeek] = useState(0);
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, i) => days.slice(i * 7, i * 7 + 7));

  // Jump to the selected day's week whenever the month or the selection's week changes.
  const selectedWeek = Math.max(0, weeks.findIndex((w) => w.some((d) => d.date === selected)));
  useEffect(() => {
    const el = pager.current;
    if (el) el.scrollTo({ left: selectedWeek * el.clientWidth, behavior: "auto" });
  }, [selectedWeek, month, days.length]);

  function scrollToWeek(i: number) {
    const el = pager.current;
    if (!el) return;
    if (i < 0) return onMonth(shiftMonth(month, -1), "last");
    if (i >= weeks.length) return onMonth(shiftMonth(month, 1), "first");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: i * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
  }

  const short = (date: string) => `${Number(date.slice(8))} ${fmtDate(date, lang, { month: "short" }).replace(".", "")}`;
  const label = fmtDate(`${month}-01`, lang, { month: "long", year: "numeric" });
  const shown = weeks[Math.min(week, weeks.length - 1)];
  const isThisMonth = Boolean(today?.startsWith(month));
  const todayWeek = isThisMonth ? weeks.findIndex((w) => w.some((d) => d.date === today)) : -1;
  // Offer a way back whenever today isn't what's on screen: another month, another week, or another day selected.
  const showToday = today !== null && (!isThisMonth || week !== todayWeek || selected !== today);

  function goToday() {
    if (!today) return;
    if (!isThisMonth) return onMonth(today.slice(0, 7));
    onSelect(today);
    scrollToWeek(todayWeek);
  }

  return (
    <div className="rounded-[24px] bg-surface p-3 shadow-[inset_0_0_0_1px_var(--line)] sm:p-4">
      <div className="flex items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-1">
          <IconButton label={a.prevMonth} onClick={() => onMonth(shiftMonth(month, -1))}>
            ‹
          </IconButton>
          <h2 className="min-w-[8.5rem] whitespace-nowrap text-center font-display text-base font-bold capitalize sm:min-w-[10rem] sm:text-lg">
            {label}
          </h2>
          <IconButton label={a.nextMonth} onClick={() => onMonth(shiftMonth(month, 1))}>
            ›
          </IconButton>
        </div>
        <AnimatePresence initial={false}>
          {showToday && (
            <motion.button
              key="today"
              type="button"
              onClick={goToday}
              className="btn btn--ghost h-9 px-3.5 text-sm"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15, ease }}
            >
              {a.today}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-1">
        <IconButton label={a.prevWeek} onClick={() => scrollToWeek(week - 1)} className="hidden sm:inline-flex">
          ←
        </IconButton>
        <div
          ref={pager}
          onScroll={(e) => {
            const el = e.currentTarget;
            setWeek(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
          }}
          className="flex min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
          role="tablist"
          aria-label={`${a.weeks}, ${label}`}
        >
          {weeks.map((w) => (
            <div key={w[0].date} className="grid w-full shrink-0 snap-start grid-cols-7 gap-1">
              {w.map((d) => {
                const active = d.date === selected;
                const dim = (today !== null && d.date < today) || !d.date.startsWith(month);
                return (
                  <button
                    key={d.date}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => onSelect(d.date)}
                    className={`relative flex flex-col items-center gap-0.5 rounded-2xl py-2.5 transition-colors duration-150 hover:bg-surface-2 ${dim ? "opacity-45" : ""}`}
                  >
                    {active && (
                      <motion.span
                        layoutId="admin-day"
                        className="absolute inset-0 rounded-2xl bg-ink"
                        transition={{ type: "spring", duration: 0.3, bounce: 0.1 }}
                      />
                    )}
                    <span
                      className={`relative text-[0.65rem] font-semibold uppercase tracking-wider ${
                        active ? "text-bg/60" : d.date === today ? "text-accent" : "text-faint"
                      }`}
                    >
                      {d.date === today ? a.todayShort : fmtDate(d.date, lang, { weekday: "short" }).replace(".", "")}
                    </span>
                    <span className={`relative text-lg font-bold tabular ${active ? "text-bg" : d.closed ? "text-faint" : "text-ink"}`}>
                      {Number(d.date.slice(8))}
                    </span>
                    <span
                      className={`relative grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.6rem] font-bold tabular ${
                        d.booked > 0 ? (active ? "bg-accent text-accent-ink" : "bg-accent/20 text-accent") : "text-transparent"
                      }`}
                    >
                      {d.booked > 0 ? d.booked : "·"}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <IconButton label={a.nextWeek} onClick={() => scrollToWeek(week + 1)} className="hidden sm:inline-flex">
          →
        </IconButton>
      </div>

      <div className="flex items-center justify-center gap-1.5 pt-3">
        {weeks.map((w, i) => (
          <button
            key={w[0].date}
            type="button"
            aria-label={`${a.week} ${short(w[0].date)} – ${short(w[6].date)}`}
            onClick={() => scrollToWeek(i)}
            className={`h-1.5 rounded-full transition-[width,background-color] duration-200 ${i === week ? "w-5 bg-ink" : "w-1.5 bg-line-strong"}`}
          />
        ))}
        {shown && (
          <span className="ml-2 text-xs text-muted tabular">
            {short(shown[0].date)} – {short(shown[6].date)}
          </span>
        )}
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
  className = "",
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`btn h-9 w-9 shrink-0 text-lg text-muted hover:bg-surface-2 hover:text-ink ${className}`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */

function SlotRow({
  date,
  slot,
  closedDay,
  settings,
  mutate,
}: {
  date: string;
  slot: AdminSlot;
  closedDay: boolean;
  settings: Settings | null;
  mutate: (path: string, init: RequestInit, okToast?: string) => Promise<boolean>;
}) {
  const { lang, a } = useAdminText();
  const [mode, setMode] = useState<"idle" | "confirm" | "book">("idle");
  const appt = slot.appointment;
  const isBooking = appt?.kind === "booking";
  const isBlock = appt?.kind === "block";
  const service = settings ? findService(settings, appt?.service) : undefined;

  const base = "rounded-2xl px-4 py-3.5 transition-colors duration-150";
  const tone = isBooking
    ? "bg-surface shadow-[inset_0_0_0_1px_var(--line-strong)]"
    : isBlock
      ? "bg-surface/40"
      : "shadow-[inset_0_0_0_1px_var(--line)]";

  return (
    <li className={`${base} ${tone} ${slot.started ? "opacity-55" : ""}`}>
      <div className="flex items-center gap-3 sm:gap-4">
        <span className={`w-12 shrink-0 text-lg font-bold tabular sm:w-14 ${isBooking ? "text-ink" : "text-muted"}`}>{slot.time}</span>

        <div className="min-w-0 flex-1">
          {isBooking ? (
            <>
              <p className="truncate font-semibold">{appt.name || a.noName}</p>
              <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
                {appt.phone && (
                  <a href={`tel:${appt.phone}`} className="text-ink tabular link-draw">
                    {formatPhone(appt.phone)}
                  </a>
                )}
                <span>
                  {service?.name[lang] ?? "—"}
                  {service && ` · ${price(service.price, lang)}`}
                </span>
                {appt.source === "admin" && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[0.7rem]">{a.byYou}</span>}
                {!slot.inSchedule && (
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[0.7rem] text-accent">{a.offSchedule}</span>
                )}
              </p>
              {appt.note && (
                <p className="mt-1.5 flex gap-1.5 text-sm text-ink/85">
                  <span aria-hidden className="font-display text-xl leading-[1.1rem] font-bold text-accent">“</span>
                  <span className="min-w-0 break-words">
                    <span className="sr-only">{a.noteLabel}: </span>
                    {appt.note}
                  </span>
                </p>
              )}
            </>
          ) : isBlock ? (
            <p className="truncate text-muted">{a.blocked}</p>
          ) : (
            <p className="truncate text-faint">{slot.started ? "—" : closedDay ? a.closedDayFree : a.free}</p>
          )}
        </div>

        {!slot.started && (
          <div className="flex shrink-0 items-center gap-1.5">
            {isBooking && mode === "idle" && (
              <button type="button" onClick={() => setMode("confirm")} className="btn btn--ghost h-9 px-3.5 text-sm">
                {a.cancel}
              </button>
            )}
            {isBooking && mode === "confirm" && (
              <>
                <button type="button" onClick={() => setMode("idle")} className="btn h-9 px-3 text-sm text-muted">
                  {a.no}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await mutate(`/api/admin/appointments/${appt.id}`, { method: "DELETE" }, "cancelled");
                    setMode("idle");
                  }}
                  className="btn h-9 bg-accent px-3.5 text-sm text-accent-ink"
                >
                  {a.yesCancel}
                </button>
              </>
            )}
            {isBlock && (
              <button
                type="button"
                onClick={() => mutate(`/api/admin/appointments/${appt.id}`, { method: "DELETE" })}
                className="btn btn--ghost h-9 px-3.5 text-sm"
              >
                {a.unblock}
              </button>
            )}
            {!appt && mode !== "book" && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    mutate("/api/admin/slots", { method: "POST", body: JSON.stringify({ action: "block", date, time: slot.time }) })
                  }
                  className="btn h-9 px-3 text-sm text-muted hover:text-ink"
                >
                  {a.block}
                </button>
                <button type="button" onClick={() => setMode("book")} className="btn btn--ghost h-9 px-3.5 text-sm">
                  {a.addBooking}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {!appt && mode === "book" && (
          <motion.div
            key="book"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease }}
            className="overflow-hidden"
          >
            <QuickBook
              services={settings ? activeServices(settings) : []}
              onCancel={() => setMode("idle")}
              onSave={async (v) => {
                const ok = await mutate(
                  "/api/admin/slots",
                  { method: "POST", body: JSON.stringify({ action: "book", date, time: slot.time, ...v }) },
                  "saved",
                );
                if (ok) setMode("idle");
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function QuickBook({
  services,
  onCancel,
  onSave,
}: {
  services: { id: string; name: { el: string; en: string } }[];
  onCancel: () => void;
  onSave: (v: { name: string; phone: string; note: string; service: string }) => Promise<void>;
}) {
  const { lang, a } = useAdminText();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [service, setService] = useState(services[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSave({ name, phone, note, service });
        setBusy(false);
      }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={a.nameOptional}
        autoFocus
        className="h-11 rounded-xl bg-bg px-3.5 text-[0.95rem] outline-none placeholder:text-faint focus:shadow-[inset_0_0_0_1px_var(--accent)]"
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder={a.phoneOptional}
        type="tel"
        inputMode="tel"
        className="h-11 rounded-xl bg-bg px-3.5 text-[0.95rem] outline-none placeholder:text-faint focus:shadow-[inset_0_0_0_1px_var(--accent)]"
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={a.noteOptional}
        maxLength={200}
        className="h-11 rounded-xl bg-bg px-3.5 text-[0.95rem] outline-none placeholder:text-faint focus:shadow-[inset_0_0_0_1px_var(--accent)] sm:col-span-2"
      />
      <div className="flex gap-1.5 sm:col-span-2">
        {services.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setService(s.id)}
            aria-pressed={service === s.id}
            className={`h-9 rounded-full px-3.5 text-sm transition-colors duration-150 ${
              service === s.id ? "bg-ink text-bg" : "text-muted shadow-[inset_0_0_0_1px_var(--line-strong)]"
            }`}
          >
            {s.name[lang]}
          </button>
        ))}
      </div>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" onClick={onCancel} className="btn h-10 px-4 text-sm text-muted">
          {a.discard}
        </button>
        <button type="submit" disabled={busy} className="btn btn--primary h-10 px-5 text-sm disabled:opacity-60">
          {a.save}
        </button>
      </div>
    </form>
  );
}
