"use client";

import { Popover } from "@base-ui/react/popover";
import { CalendarDaysIcon } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { el, enUS } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";
import type { AdminDict } from "@/lib/admin-i18n";
import type { Lang } from "@/lib/config";
import { fmtDate } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/* The app keeps dates as "YYYY-MM-DD"; the calendar works with local Date objects at midnight. */
const toDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const toStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Holiday range picker: a trigger that opens the shadcn Calendar (range mode) in a popover.
 * Past days are disabled and days already closed are marked.
 */
export function HolidayRangePicker({
  from,
  to,
  onChange,
  today,
  closedDates,
  lang,
  labels: a,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  today: string | null;
  closedDates: string[];
  lang: Lang;
  labels: AdminDict;
}) {
  const [open, setOpen] = useState(false);
  const selected: DateRange | undefined = from ? { from: toDate(from), to: to ? toDate(to) : undefined } : undefined;
  const short = (s: string) => fmtDate(s, lang, { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "");
  const label = !from ? a.pickDays : !to || to === from ? short(from) : `${short(from)} – ${short(to)}`;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={cn(
          "flex h-11 w-full items-center gap-2.5 rounded-xl bg-bg px-3.5 text-left text-[0.95rem] outline-none transition-shadow duration-150 focus-visible:shadow-[inset_0_0_0_1px_var(--accent)]",
          open && "shadow-[inset_0_0_0_1px_var(--accent)]",
        )}
      >
        <CalendarDaysIcon className="size-4 shrink-0 text-muted" aria-hidden />
        <span className={cn("truncate capitalize", !from && "text-faint normal-case")}>{label}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={8} className="z-50">
          <Popover.Popup className="origin-(--transform-origin) rounded-[20px] bg-surface-2 p-2 shadow-[inset_0_0_0_1px_var(--line-strong),0_24px_60px_-20px_rgb(0_0_0/0.9)] outline-none transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            <Calendar
              mode="range"
              selected={selected}
              onSelect={(range) => {
                if (!range?.from) return onChange("", "");
                onChange(toStr(range.from), range.to ? toStr(range.to) : "");
              }}
              defaultMonth={selected?.from ?? (today ? toDate(today) : undefined)}
              disabled={today ? { before: toDate(today) } : undefined}
              locale={lang === "el" ? el : enUS}
              weekStartsOn={1}
              modifiers={{ closed: closedDates.map(toDate) }}
              modifiersClassNames={{
                closed: "[&>button]:line-through [&>button]:decoration-accent [&>button]:decoration-2",
              }}
            />
            <div className="flex items-center justify-between gap-3 border-t border-line px-2 pt-2.5 pb-1">
              <span className="text-xs text-faint">{a.rangeHint}</span>
              <span className="flex gap-1">
                <button
                  type="button"
                  onClick={() => onChange("", "")}
                  disabled={!from}
                  className="btn h-8 px-3 text-xs text-muted hover:text-ink disabled:opacity-40"
                >
                  {a.clear}
                </button>
                <Popover.Close className="btn btn--primary h-8 px-3.5 text-xs">{a.done}</Popover.Close>
              </span>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
