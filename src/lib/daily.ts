import { z } from "zod";

import { parseIsoDate, toIsoDate, todayYmd } from "@/lib/birth-date";

/**
 * Daily horoscopes (home's "today" view, /admin/daily). Days are plain calendar dates in
 * Mongolia time ("YYYY-MM-DD"). Safe to import from client and server.
 */

/** Home shows either the account owner's day ("today") or the planet system. */
export const HOME_VIEWS = ["today", "planets"] as const;
export type HomeView = (typeof HOME_VIEWS)[number];
export const HOME_VIEW_COOKIE = "home_view";

/**
 * The view home opens on: the one picked last (cookie), else "today" — except while the
 * first-run guide is on, which lives on the planets.
 */
export function initialHomeView(cookie: string | undefined, guideActive: boolean): HomeView {
  const parsed = z.enum(HOME_VIEWS).safeParse(cookie);
  if (parsed.success) return parsed.data;
  return guideActive ? "planets" : "today";
}

export const isoDateSchema = z.string().refine((v) => parseIsoDate(v) !== null, "invalid date");

/** Today in Mongolia as "YYYY-MM-DD". */
export function todayIso(now: Date = new Date()): string {
  return toIsoDate(todayYmd(now));
}

/** "2026-10-02" + 3 → "2026-10-05" (crosses months, years and 02-29 correctly). */
export function addDays(iso: string, days: number): string {
  const ymd = parseIsoDate(iso);
  if (!ymd) throw new Error(`Invalid date: ${iso}`);
  const d = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d + days));
  return toIsoDate({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() });
}

/** 0 = Monday … 6 = Sunday (the Mongolian week starts on Monday). */
export function weekdayOf(iso: string): number {
  const ymd = parseIsoDate(iso);
  if (!ymd) throw new Error(`Invalid date: ${iso}`);
  return (new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d)).getUTCDay() + 6) % 7;
}

const WEEKDAYS = ["Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба", "Ням"];

/** "2026-10-02" → "10-р сарын 2, Баасан" */
export function dayLabel(iso: string): string {
  const ymd = parseIsoDate(iso);
  if (!ymd) return iso;
  return `${ymd.m}-р сарын ${ymd.d}, ${WEEKDAYS[weekdayOf(iso)]}`;
}

/** "2026-10-02" → "10.02 Ба" (the admin's day strip). */
export function shortDayLabel(iso: string): string {
  return `${iso.slice(5, 7)}.${iso.slice(8, 10)} ${WEEKDAYS[weekdayOf(iso)].slice(0, 2)}`;
}
