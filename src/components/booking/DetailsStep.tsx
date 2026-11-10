"use client";

import { AnimatePresence, motion, useAnimate } from "motion/react";
import { useId, useState } from "react";
import { RollText } from "@/components/RollText";
import type { PublicBooking } from "@/lib/bookings";
import type { Lang } from "@/lib/config";
import { price, shortDate, type Dict } from "@/lib/i18n";
import type { PublicShop } from "@/lib/settings";
import { KEYS, readJSON, writeJSON, type Me } from "@/lib/storage";
import { NOTE_MAX } from "@/lib/validate";

const ease = [0.23, 1, 0.32, 1] as const;
const SLOT_ERRORS = new Set(["taken", "past", "closed", "invalid_slot"]);

export function DetailsStep({
  date,
  time,
  services,
  slotMinutes,
  service,
  onService,
  onBack,
  onBooked,
  onSlotGone,
  lang,
  t,
}: {
  date: string;
  time: string;
  services: PublicShop["services"];
  slotMinutes: number;
  service: string;
  onService: (id: string) => void;
  onBack: () => void;
  onBooked: (b: PublicBooking) => void;
  onSlotGone: () => void;
  lang: Lang;
  t: Dict;
}) {
  const [me] = useState<Me>(() =>
    typeof window === "undefined" ? { name: "", phone: "" } : readJSON<Me>(KEYS.me, { name: "", phone: "" }),
  );
  const [name, setName] = useState(me.name);
  const [phone, setPhone] = useState(me.phone);
  const [note, setNote] = useState("");
  // Error codes, not strings, so messages follow a language switch.
  const [errors, setErrors] = useState<{ name?: string; phone?: string; note?: string; form?: string }>({});
  const [slotGone, setSlotGone] = useState(false);
  const [sending, setSending] = useState(false);
  const [scope, animate] = useAnimate();
  const id = useId();
  const current = services.find((s) => s.id === service) ?? services[0];

  function shake() {
    if (scope.current) animate(scope.current, { x: [0, -8, 8, -5, 5, 0] }, { duration: 0.4, ease: "easeOut" });
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    const form = new FormData(e.currentTarget);
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = "invalid_name";
    if (phone.replace(/\D/g, "").length < 10) next.phone = "invalid_phone";
    if ([...note.trim()].length > NOTE_MAX) next.note = "invalid_note";
    setErrors(next);
    if (next.name || next.phone || next.note) return shake();

    setSending(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, time, service, name, phone, note, website: form.get("website") }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        writeJSON(KEYS.me, { name: name.trim(), phone: phone.trim() });
        onBooked(data.booking as PublicBooking);
        return;
      }
      const code = typeof data.error === "string" ? data.error : "generic";
      if (code === "invalid_name") setErrors({ name: code });
      else if (code === "invalid_phone") setErrors({ phone: code });
      else if (code === "invalid_note") setErrors({ note: code });
      else {
        setErrors({ form: code in t.errors ? code : "generic" });
        if (SLOT_ERRORS.has(code)) {
          setSlotGone(true);
          onSlotGone();
        }
      }
      shake();
    } catch {
      setErrors({ form: "generic" });
      shake();
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-7">
      <button
        type="button"
        onClick={onBack}
        className="group -mx-1 flex items-center justify-between gap-4 rounded-2xl bg-surface-2/70 px-4 py-3.5 text-left transition-colors duration-200 hover:bg-surface-2"
      >
        <span className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-bg text-muted transition-transform duration-200 ease-out group-hover:-translate-x-0.5" aria-hidden>
            ←
          </span>
          <span>
            <span className="block text-[0.95rem] font-semibold capitalize">{shortDate(date, lang)}</span>
            <span className="block text-sm text-muted tabular">{time}</span>
          </span>
        </span>
        <span className="text-sm text-muted">{t.change}</span>
      </button>

      <fieldset>
        <legend className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t.service}</legend>
        <div className="grid grid-cols-2 gap-2 rounded-[22px] bg-bg/60 p-1.5" role="radiogroup">
          {services.map((s) => {
            const active = s.id === service;
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onService(s.id)}
                className="relative rounded-[16px] px-3 py-3 text-left"
              >
                {active && (
                  <motion.span
                    layoutId="service-pill"
                    className="absolute inset-0 rounded-[16px] bg-surface-2 shadow-[inset_0_0_0_1px_var(--line-strong)]"
                    transition={{ type: "spring", duration: 0.45, bounce: 0.15 }}
                  />
                )}
                <span className={`relative block text-[0.9rem] font-semibold leading-snug transition-colors duration-200 ${active ? "text-ink" : "text-muted"}`}>
                  {s.name[lang]}
                </span>
                <span className="relative mt-0.5 block text-sm text-muted tabular">
                  {price(s.price, lang)} · {slotMinutes}′
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div ref={scope} className="flex flex-col gap-5">
        <Field
          id={`${id}-name`}
          label={t.name}
          value={name}
          onChange={(v) => {
            setName(v);
            if (errors.name || (errors.form && !slotGone)) setErrors((e) => ({ ...e, name: undefined, form: slotGone ? e.form : undefined }));
          }}
          error={errors.name && t.errors[errors.name]}
          autoComplete="name"
          enterKeyHint="next"
        />
        <Field
          id={`${id}-phone`}
          label={t.phone}
          value={phone}
          onChange={(v) => {
            setPhone(v);
            if (errors.phone || (errors.form && !slotGone)) setErrors((e) => ({ ...e, phone: undefined, form: slotGone ? e.form : undefined }));
          }}
          error={errors.phone && t.errors[errors.phone]}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          enterKeyHint="next"
        />
        <NoteField
          id={`${id}-note`}
          label={t.note}
          placeholder={t.notePlaceholder}
          value={note}
          onChange={(v) => {
            setNote(v);
            if (errors.note) setErrors((e) => ({ ...e, note: undefined }));
          }}
          error={errors.note && t.errors[errors.note]}
        />
        {/* Honeypot for bots: hidden from people and assistive tech. */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      </div>

      <AnimatePresence initial={false}>
        {errors.form && (
          <motion.div
            key="form-error"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-accent/10 px-4 py-3 text-sm text-ink shadow-[inset_0_0_0_1px_rgb(255_91_53/0.35)]" role="alert">
              <span>{t.errors[errors.form]}</span>
              {slotGone && (
                <button type="button" onClick={onBack} className="font-semibold text-accent link-draw">
                  {t.pickAnother} →
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-4">
        <button type="submit" disabled={sending || slotGone} className="btn btn--primary h-14 w-full text-base disabled:opacity-60">
          <AnimatePresence mode="popLayout" initial={false}>
            {sending ? (
              <motion.span
                key="sending"
                className="flex items-center gap-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease }}
              >
                <span className="spinner" aria-hidden />
                {t.booking}
              </motion.span>
            ) : (
              <motion.span
                key="idle"
                className="flex items-center gap-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease }}
              >
                {t.book}
                <span className="text-bg/40">·</span>
                <RollText text={price(current.price, lang)} className="tabular" />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        <p className="text-center text-[0.8rem] leading-relaxed text-muted">{t.noVerify}</p>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  ...rest
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "id">) {
  return (
    <div>
      <div className="field" data-invalid={Boolean(error)}>
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder=" "
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-err` : undefined}
          {...rest}
        />
        <label htmlFor={id}>{label}</label>
        <span className="field__bar" aria-hidden />
      </div>
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            id={`${id}-err`}
            key="err"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease }}
            className="mt-2 text-sm text-accent"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Optional free-text note for the barber, same look as the other fields. */
function NoteField({
  id,
  label,
  placeholder,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const length = [...value].length;
  const nearLimit = length > NOTE_MAX - 40;
  return (
    <div>
      <div className="field" data-invalid={Boolean(error)}>
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder=" "
          rows={1}
          maxLength={NOTE_MAX + 20}
          enterKeyHint="done"
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-hint`}
        />
        <label htmlFor={id}>{label}</label>
        <span className="field__bar" aria-hidden />
      </div>
      <p id={`${id}-hint`} className="mt-2 flex justify-between gap-3 text-sm">
        <span className={error ? "text-accent" : "text-faint"}>{error ?? placeholder}</span>
        {nearLimit && (
          <span className={`tabular ${length > NOTE_MAX ? "text-accent" : "text-faint"}`}>
            {length}/{NOTE_MAX}
          </span>
        )}
      </p>
    </div>
  );
}
