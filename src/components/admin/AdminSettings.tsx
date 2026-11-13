"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { adminDict } from "@/lib/admin-i18n";
import { fmtDate } from "@/lib/i18n";
import {
  SLOT_CHOICES,
  checkDayRanges,
  validateSettings,
  type ServiceSetting,
  type Settings,
} from "@/lib/settings";
import { addDays, fromMinutes, toMinutes } from "@/lib/time";
import { HolidayRangePicker } from "./HolidayRangePicker";

const ease = [0.23, 1, 0.32, 1] as const;
const WEEK = [1, 2, 3, 4, 5, 6, 0]; // Monday first

type Holiday = { date: string; note: string | null; booked: number };
type HolidayGroup = { from: string; to: string; note: string | null; booked: number; dates: string[] };

const inputCls =
  "h-11 w-full rounded-xl bg-bg px-3.5 text-[0.95rem] outline-none placeholder:text-faint focus:shadow-[inset_0_0_0_1px_var(--accent)] [color-scheme:dark]";

function countSlots(ranges: [string, string][], slot: number) {
  return ranges.reduce((n, [a, b]) => n + Math.max(0, Math.floor((toMinutes(b) - toMinutes(a)) / slot)), 0);
}

/** Consecutive days with the same note read as one holiday: "24 – 26 Δεκ · Χριστούγεννα". */
function groupHolidays(list: Holiday[]): HolidayGroup[] {
  const groups: HolidayGroup[] = [];
  for (const h of list) {
    const last = groups.at(-1);
    if (last && addDays(last.to, 1) === h.date && last.note === h.note) {
      last.to = h.date;
      last.booked += h.booked;
      last.dates.push(h.date);
    } else {
      groups.push({ from: h.date, to: h.date, note: h.note, booked: h.booked, dates: [h.date] });
    }
  }
  return groups;
}

export function AdminSettings({
  settings,
  today,
  onSaved,
  onToast,
  onUnauthorized,
}: {
  settings: Settings;
  today: string | null;
  onSaved: (s: Settings) => void;
  onToast: (msg: string) => void;
  onUnauthorized: () => void;
}) {
  const { lang } = useLang();
  const a = adminDict[lang];
  const [draft, setDraft] = useState<Settings>(settings);
  const [base, setBase] = useState<Settings>(settings);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(base);
  const check = validateSettings(draft);
  const errorCode = serverError ?? (check.ok ? null : check.error);

  const update = (fn: (d: Settings) => Settings) => {
    setServerError(null);
    setDraft((d) => fn(structuredClone(d)));
  };

  async function save() {
    if (!check.ok || saving) return;
    setSaving(true);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: draft }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.status === 401) return onUnauthorized();
    if (!res.ok) return setServerError(typeof data.error === "string" ? data.error : "invalid");
    setDraft(data.settings);
    setBase(data.settings);
    onSaved(data.settings);
    onToast("settingsSaved");
  }

  const visibleServices = draft.services.filter((s) => !s.archived);

  return (
    <div className="flex flex-col gap-6 pb-28">
      {/* Services & prices */}
      <Section title={a.servicesTitle} hint={a.servicesHint(draft.slotMinutes)}>
        <div className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {visibleServices.map((s) => (
              <motion.div
                key={s.id}
                layout="position"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease }}
                className="overflow-hidden"
              >
                <ServiceRow
                  service={s}
                  canRemove={visibleServices.length > 1}
                  labels={a}
                  onChange={(next) => update((d) => ({ ...d, services: d.services.map((x) => (x.id === s.id ? next : x)) }))}
                  onRemove={() => update((d) => ({ ...d, services: d.services.filter((x) => x.id !== s.id) }))}
                />
              </motion.div>
            ))}
          </AnimatePresence>
          <button
            type="button"
            onClick={() =>
              update((d) => ({
                ...d,
                services: [...d.services, { id: `svc-${Date.now().toString(36)}`, name: { el: "", en: "" }, price: 10 }],
              }))
            }
            className="btn btn--ghost h-10 self-start px-4 text-sm"
          >
            {a.addService}
          </button>
        </div>
      </Section>

      {/* Opening hours */}
      <Section title={a.hoursTitle} hint={a.hoursHint}>
        <div className="flex flex-col divide-y divide-line">
          {WEEK.map((d, i) => (
            <DayHours
              key={d}
              label={a.weekdaysLong[i]}
              ranges={draft.hours[d] ?? []}
              slotMinutes={draft.slotMinutes}
              labels={a}
              showCopy={d === 1}
              onChange={(ranges) => update((s) => ({ ...s, hours: { ...s.hours, [d]: ranges } }))}
              onCopyWeekdays={() =>
                update((s) => {
                  const monday = s.hours[1] ?? [];
                  const hours = { ...s.hours };
                  for (const wd of [2, 3, 4, 5]) hours[wd] = monday.map(([x, y]) => [x, y] as [string, string]);
                  return { ...s, hours };
                })
              }
            />
          ))}
        </div>
      </Section>

      {/* Booking rules */}
      <Section title={a.rulesTitle}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={a.slotLength} hint={a.slotHint}>
            <div className="flex items-center gap-3">
              <select
                value={draft.slotMinutes}
                onChange={(e) => update((d) => ({ ...d, slotMinutes: Number(e.target.value) }))}
                className={`${inputCls} max-w-[8rem]`}
              >
                {[...new Set([...SLOT_CHOICES, draft.slotMinutes])].sort((x, y) => x - y).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <span className="text-sm text-muted">{a.minutesUnit}</span>
            </div>
          </Field>
          <NumberField
            label={a.windowDays}
            unit={a.windowUnit}
            value={draft.windowDays}
            min={1}
            max={180}
            onChange={(v) => update((d) => ({ ...d, windowDays: v }))}
          />
          <NumberField
            label={a.lead}
            unit={a.leadUnit}
            value={draft.minLeadMinutes}
            min={0}
            max={2880}
            step={5}
            onChange={(v) => update((d) => ({ ...d, minLeadMinutes: v }))}
          />
          <NumberField
            label={a.maxPerPhone}
            unit={a.maxUnit}
            value={draft.maxActivePerPhone}
            min={1}
            max={20}
            onChange={(v) => update((d) => ({ ...d, maxActivePerPhone: v }))}
          />
        </div>
      </Section>

      {/* Holidays (saved straight away, separate from the form above) */}
      <Holidays today={today} onToast={onToast} onUnauthorized={onUnauthorized} />

      {/* Save bar */}
      <AnimatePresence>
        {(dirty || serverError) && (
          <motion.div
            key="savebar"
            className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[min(42rem,calc(100%-2rem))] flex-wrap items-center justify-between gap-3 rounded-[22px] bg-surface-2 px-4 py-3 shadow-[inset_0_0_0_1px_var(--line-strong),0_24px_60px_-20px_rgb(0_0_0/0.9)]"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.22, ease }}
            role="region"
            aria-label={a.unsaved}
          >
            <span className={`text-sm ${errorCode ? "text-accent" : "text-muted"}`}>
              {errorCode ? (a.settingsErrors[errorCode] ?? a.settingsErrors.invalid) : a.unsaved}
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setServerError(null);
                  setDraft(base);
                }}
                className="btn h-10 px-4 text-sm text-muted hover:text-ink"
              >
                {a.revert}
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!check.ok || saving}
                className="btn btn--primary h-10 px-5 text-sm disabled:opacity-50"
              >
                {saving ? a.saving : a.save}
              </button>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */

type Labels = (typeof adminDict)["el"];

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[24px] bg-surface p-4 shadow-[inset_0_0_0_1px_var(--line)] sm:p-6">
      <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{label}</span>
      {children}
      {hint && <span className="text-xs leading-relaxed text-faint">{hint}</span>}
    </label>
  );
}

function NumberField({
  label,
  unit,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          value={Number.isNaN(value) ? "" : value}
          onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
          className={`${inputCls} max-w-[8rem] tabular`}
        />
        <span className="text-sm text-muted">{unit}</span>
      </div>
    </Field>
  );
}

function ServiceRow({
  service,
  canRemove,
  labels: a,
  onChange,
  onRemove,
}: {
  service: ServiceSetting;
  canRemove: boolean;
  labels: Labels;
  onChange: (s: ServiceSetting) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-2 rounded-2xl bg-bg/50 p-2.5 sm:grid-cols-[1.3fr_1.3fr_7rem_auto] sm:items-center">
      <input
        value={service.name.el}
        onChange={(e) => onChange({ ...service, name: { ...service.name, el: e.target.value } })}
        placeholder={a.nameEl}
        aria-label={a.nameEl}
        maxLength={60}
        className={`${inputCls} col-span-2 sm:col-span-1`}
      />
      <input
        value={service.name.en}
        onChange={(e) => onChange({ ...service, name: { ...service.name, en: e.target.value } })}
        placeholder={a.nameEn}
        aria-label={a.nameEn}
        maxLength={60}
        className={`${inputCls} col-span-2 sm:col-span-1`}
      />
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={1000}
          step={0.5}
          value={Number.isNaN(service.price) ? "" : service.price}
          onChange={(e) => onChange({ ...service, price: e.target.value === "" ? NaN : Number(e.target.value) })}
          aria-label={a.priceEur}
          className={`${inputCls} pr-8 tabular`}
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted">€</span>
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label={a.removeService}
        title={a.removeService}
        className="btn h-11 w-11 text-lg text-muted hover:bg-surface-2 hover:text-accent disabled:opacity-30"
      >
        ×
      </button>
    </div>
  );
}

function DayHours({
  label,
  ranges,
  slotMinutes,
  labels: a,
  showCopy,
  onChange,
  onCopyWeekdays,
}: {
  label: string;
  ranges: [string, string][];
  slotMinutes: number;
  labels: Labels;
  showCopy: boolean;
  onChange: (r: [string, string][]) => void;
  onCopyWeekdays: () => void;
}) {
  const open = ranges.length > 0;
  const error = open ? checkDayRanges(ranges) : null;

  function addBreak() {
    const last = ranges.at(-1);
    if (!last) return;
    const start = toMinutes(last[0]);
    const end = toMinutes(last[1]);
    const mid = Math.round((start + end) / 2 / 60) * 60;
    if (mid - start < slotMinutes || end - (mid + 60) < slotMinutes) return;
    onChange([...ranges.slice(0, -1), [last[0], fromMinutes(mid)], [fromMinutes(mid + 60), last[1]]]);
  }

  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-6">
      <div className="flex items-center justify-between gap-3 sm:w-44 sm:shrink-0 sm:pt-2">
        <span className="font-semibold">{label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={open}
          aria-label={`${label}: ${open ? a.dayOpen : a.dayClosed}`}
          onClick={() => onChange(open ? [] : [["10:00", "20:00"]])}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${open ? "bg-accent" : "bg-line-strong"}`}
        >
          <motion.span
            className="absolute top-1 left-1 h-5 w-5 rounded-full bg-ink"
            animate={{ x: open ? 20 : 0 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
          />
        </button>
      </div>

      <div className="min-w-0 flex-1">
        {open ? (
          <div className="flex flex-col gap-2">
            {ranges.map(([from, to], i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="time"
                  step={300}
                  value={from}
                  onChange={(e) => onChange(ranges.map((r, j) => (j === i ? [e.target.value, r[1]] : r)))}
                  className={`${inputCls} max-w-[8.5rem] tabular ${error ? "shadow-[inset_0_0_0_1px_var(--accent)]" : ""}`}
                />
                <span className="text-muted">–</span>
                <input
                  type="time"
                  step={300}
                  value={to}
                  onChange={(e) => onChange(ranges.map((r, j) => (j === i ? [r[0], e.target.value] : r)))}
                  className={`${inputCls} max-w-[8.5rem] tabular ${error ? "shadow-[inset_0_0_0_1px_var(--accent)]" : ""}`}
                />
                {ranges.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onChange(ranges.filter((_, j) => j !== i))}
                    aria-label={a.removeRange}
                    title={a.removeRange}
                    className="btn h-9 w-9 shrink-0 text-lg text-muted hover:bg-surface-2 hover:text-accent"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-sm">
              <span className={error ? "text-accent" : "text-faint"}>
                {error ? a.settingsErrors[error] : a.slotsPerDay(countSlots(ranges, slotMinutes))}
              </span>
              {ranges.length < 3 && (
                <button type="button" onClick={addBreak} className="text-muted link-draw hover:text-ink">
                  {a.addBreak}
                </button>
              )}
              {showCopy && (
                <button type="button" onClick={onCopyWeekdays} className="text-muted link-draw hover:text-ink">
                  {a.copyWeekdays}
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="pt-2 text-faint">{a.dayClosed}</p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Holidays({
  today,
  onToast,
  onUnauthorized,
}: {
  today: string | null;
  onToast: (msg: string) => void;
  onUnauthorized: () => void;
}) {
  const { lang } = useLang();
  const a = adminDict[lang];
  const [list, setList] = useState<Holiday[] | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/admin/holidays", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) return onUnauthorized();
        const data = await res.json();
        if (res.ok) setList(data.holidays);
      })
      .catch(() => onToast("offline"));
  }, [onToast, onUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!from || busy) return;
    setBusy(true);
    const res = await fetch("/api/admin/holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: to && to >= from ? to : from, note }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.status === 401) return onUnauthorized();
    if (!res.ok) return onToast("generic");
    onToast(data.booked > 0 ? a.bookedWarning(data.booked) : "holidayAdded");
    setFrom("");
    setTo("");
    setNote("");
    load();
  }

  async function reopen(dates: string[]) {
    const res = await fetch("/api/admin/holidays", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dates }),
    });
    if (res.status === 401) return onUnauthorized();
    onToast(res.ok ? "holidayRemoved" : "generic");
    load();
  }

  const short = (d: string) => fmtDate(d, lang, { day: "numeric", month: "short", weekday: "short" }).replace(/\./g, "");
  const groups = list ? groupHolidays(list) : [];

  return (
    <Section title={a.holidaysTitle} hint={a.holidaysHint}>
      <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1.3fr_1.3fr_auto] sm:items-end">
        {/* Not a <label>: the calendar opens in a popover outside this element. */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{a.days}</span>
          <HolidayRangePicker
            from={from}
            to={to}
            onChange={(f, t) => {
              setFrom(f);
              setTo(t);
            }}
            today={today}
            closedDates={list?.map((h) => h.date) ?? []}
            lang={lang}
            labels={a}
          />
        </div>
        <Field label={a.note}>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={a.notePlaceholder} maxLength={80} className={inputCls} />
        </Field>
        <button type="submit" disabled={!from || busy} className="btn btn--primary h-11 px-5 text-sm disabled:opacity-50">
          {a.addHoliday}
        </button>
      </form>

      <ul className="mt-5 flex flex-col gap-2">
        {list === null && <li className="text-sm text-faint">{a.loading}</li>}
        {list && groups.length === 0 && <li className="text-sm text-faint">{a.noHolidays}</li>}
        <AnimatePresence initial={false}>
          {groups.map((g) => (
            <motion.li
              key={g.from}
              layout="position"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.2, ease }}
              className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3 shadow-[inset_0_0_0_1px_var(--line)]"
            >
              <span className="min-w-0">
                <span className="block font-semibold capitalize">
                  {g.from === g.to ? short(g.from) : `${short(g.from)} – ${short(g.to)}`}
                </span>
                <span className="block truncate text-sm text-muted">
                  {g.note}
                  {g.note && g.booked > 0 && " · "}
                  {g.booked > 0 && <span className="text-accent">{a.holidayBooked(g.booked)}</span>}
                </span>
              </span>
              <button type="button" onClick={() => reopen(g.dates)} className="btn btn--ghost h-9 shrink-0 px-3.5 text-sm">
                {a.reopen}
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </Section>
  );
}
