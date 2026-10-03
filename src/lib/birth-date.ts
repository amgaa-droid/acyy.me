import { z } from "zod";

/** Birth date helpers (SPEC §2.1). Dates are plain calendar dates "YYYY-MM-DD", no time zone. */

export const MIN_BIRTH_YEAR = 1900;
export const APP_TIME_ZONE = "Asia/Ulaanbaatar";

export type Ymd = { y: number; m: number; d: number };

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

const pad = (n: number, len = 2) => String(n).padStart(len, "0");

export function toIsoDate({ y, m, d }: Ymd): string {
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
}

/** "1985-04-02" → "1985.04.02" (how birth dates are shown in the UI). */
export function formatBirthDate(value: string): string {
  return value.replaceAll("-", ".");
}

/** "05-21" → "05.21": a month-day, in the same dotted form as a full date. */
export function formatMonthDay(value: string): string {
  return value.replaceAll("-", ".");
}

const dateTimeParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function partsOf(at: Date): Record<string, string> {
  return Object.fromEntries(dateTimeParts.formatToParts(at).map((p) => [p.type, p.value]));
}

/** A moment as a date in Mongolia, "2026.10.02" — every date in the UI is written this way. */
export function formatDate(at: Date): string {
  const p = partsOf(at);
  return `${p.year}.${p.month}.${p.day}`;
}

/** A moment as the time of day in Mongolia, "18:27". */
export function formatTime(at: Date): string {
  const p = partsOf(at);
  return `${p.hour}:${p.minute}`;
}

/** A moment as date and time in Mongolia, "2026.10.02 18:27". */
export function formatDateTime(at: Date): string {
  const p = partsOf(at);
  return `${p.year}.${p.month}.${p.day} ${p.hour}:${p.minute}`;
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses "YYYY-MM-DD"; returns null for malformed or impossible dates (e.g. 2023-02-29). */
export function parseIsoDate(value: string): Ymd | null {
  const match = ISO_RE.exec(value);
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

const ymdFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's calendar date in Mongolia, regardless of the server's time zone. */
export function todayYmd(now: Date = new Date()): Ymd {
  const parts = ymdFormat.formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

export function compareYmd(a: Ymd, b: Ymd): number {
  return a.y - b.y || a.m - b.m || a.d - b.d;
}

/** Clamps to a real date within [1900-01-01, today]. Used by the date picker as columns change. */
export function clampBirthDate(value: Ymd, today: Ymd): Ymd {
  const y = Math.min(Math.max(value.y, MIN_BIRTH_YEAR), today.y);
  const m = Math.min(Math.max(value.m, 1), y === today.y ? today.m : 12);
  const maxD = y === today.y && m === today.m ? today.d : daysInMonth(y, m);
  const d = Math.min(Math.max(value.d, 1), maxD);
  return { y, m, d };
}

export type BirthDateError = "invalid" | "future" | "too_old";

export function validateBirthDate(value: string, today: Ymd = todayYmd()): BirthDateError | null {
  const ymd = parseIsoDate(value);
  if (!ymd) return "invalid";
  if (ymd.y < MIN_BIRTH_YEAR) return "too_old";
  if (compareYmd(ymd, today) > 0) return "future";
  return null;
}

/** Full age in years on `today` (a 02-29 birthday counts on 03-01 in non-leap years). */
export function ageOn(birth: Ymd, today: Ymd): number {
  const hadBirthday = today.m > birth.m || (today.m === birth.m && today.d >= birth.d);
  return today.y - birth.y - (hadBirthday ? 0 : 1);
}

export const birthDateSchema = z.string().superRefine((value, ctx) => {
  const error = validateBirthDate(value);
  if (error) ctx.addIssue({ code: "custom", message: error });
});
