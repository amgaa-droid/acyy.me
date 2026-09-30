"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { mn } from "@/i18n/mn";
import {
  MIN_BIRTH_YEAR,
  clampBirthDate,
  daysInMonth,
  parseIsoDate,
  todayYmd,
  toIsoDate,
  type Ymd,
} from "@/lib/birth-date";
import { cn } from "@/lib/utils";

const ITEM_H = 44;
const VISIBLE = 5;
const DEFAULT_VALUE: Ymd = { y: 2000, m: 1, d: 1 };

type DatePickerProps = {
  /** "YYYY-MM-DD" */
  value?: string;
  onChange?: (value: string) => void;
  /** Adds a hidden input so the value is submitted with a form. */
  name?: string;
  className?: string;
};

/** iOS-style wheel picker: Year / Month / Day. Only real dates within [1900, today] are selectable. */
export function DatePicker({ value, onChange, name, className }: DatePickerProps) {
  const today = useMemo(() => todayYmd(), []);
  const [internal, setInternal] = useState<Ymd>(() =>
    clampBirthDate((value && parseIsoDate(value)) || DEFAULT_VALUE, today),
  );
  const current = (value && parseIsoDate(value)) || internal;

  const update = (next: Ymd) => {
    const clamped = clampBirthDate(next, today);
    setInternal(clamped);
    onChange?.(toIsoDate(clamped));
  };

  const years = useMemo(
    () => Array.from({ length: today.y - MIN_BIRTH_YEAR + 1 }, (_, i) => MIN_BIRTH_YEAR + i),
    [today.y],
  );
  const monthCount = current.y === today.y ? today.m : 12;
  const dayCount =
    current.y === today.y && current.m === today.m ? today.d : daysInMonth(current.y, current.m);

  return (
    <div className={cn("relative grid grid-cols-[1.2fr_1.4fr_1fr] gap-2", className)}>
      {name && <input type="hidden" name={name} value={toIsoDate(current)} />}
      {/* Selection band */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 border-y"
        style={{ top: ITEM_H * Math.floor(VISIBLE / 2), height: ITEM_H }}
      />
      <WheelColumn
        label={mn.datePicker.year}
        items={years.map(String)}
        index={current.y - MIN_BIRTH_YEAR}
        onIndexChange={(i) => update({ ...current, y: years[i] })}
      />
      <WheelColumn
        label={mn.datePicker.month}
        items={mn.datePicker.months.slice(0, monthCount)}
        index={current.m - 1}
        onIndexChange={(i) => update({ ...current, m: i + 1 })}
      />
      <WheelColumn
        label={mn.datePicker.day}
        items={Array.from({ length: dayCount }, (_, i) => String(i + 1))}
        index={current.d - 1}
        onIndexChange={(i) => update({ ...current, d: i + 1 })}
      />
    </div>
  );
}

type WheelColumnProps = {
  label: string;
  items: readonly string[];
  index: number;
  onIndexChange: (index: number) => void;
};

function WheelColumn({ label, items, index, onIndexChange }: WheelColumnProps) {
  const ref = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pad = ITEM_H * Math.floor(VISIBLE / 2);

  // Keep scroll position in sync when the value changes from outside (or gets clamped).
  useEffect(() => {
    const el = ref.current;
    if (el && Math.abs(el.scrollTop - index * ITEM_H) > 1) el.scrollTop = index * ITEM_H;
  }, [index, items.length]);

  useEffect(() => () => clearTimeout(settleTimer.current), []);

  const onScroll = () => {
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)));
      if (i !== index) onIndexChange(i);
    }, 120);
  };

  const select = (i: number) => {
    const next = Math.min(items.length - 1, Math.max(0, i));
    ref.current?.scrollTo({ top: next * ITEM_H, behavior: "smooth" });
    if (next !== index) onIndexChange(next);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const step = { ArrowDown: 1, ArrowUp: -1, PageDown: 5, PageUp: -5 }[e.key];
    if (step !== undefined) {
      e.preventDefault();
      select(index + step);
    } else if (e.key === "Home") {
      e.preventDefault();
      select(0);
    } else if (e.key === "End") {
      e.preventDefault();
      select(items.length - 1);
    }
  };

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={label}
      aria-activedescendant={`${label}-${index}`}
      tabIndex={0}
      onScroll={onScroll}
      onKeyDown={onKeyDown}
      className="scrollbar-none snap-y snap-mandatory overflow-y-scroll overscroll-contain rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      style={{
        height: ITEM_H * VISIBLE,
        paddingBlock: pad,
        maskImage: "linear-gradient(to bottom, transparent, black 35%, black 65%, transparent)",
      }}
    >
      {items.map((item, i) => (
        <div
          key={item}
          id={`${label}-${i}`}
          role="option"
          aria-selected={i === index}
          onClick={() => select(i)}
          className={cn(
            "flex snap-center items-center justify-center text-lg tabular-nums transition-colors select-none",
            i === index ? "font-medium text-fg" : "text-muted-foreground",
          )}
          style={{ height: ITEM_H }}
        >
          {item}
        </div>
      ))}
    </div>
  );
}
