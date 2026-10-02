import { z } from "zod";

import { BIRTHDAY_PART, BIRTHDAY_PRODUCT } from "@/lib/catalog-refs";
import { describeBirthDate, loadAstroRefs } from "@/server/astro/refs";
import { isMonthDay, type MonthDay } from "@/server/astro/calendar";
import type { AppDb } from "@/server/db/types";
import { getPreview } from "@/server/reading";

/**
 * The landing page's free "pick your birthday" hook. Returns only what the paywall preview
 * already shows (SPEC §3.1): sign, period, the birthday text's title + teaser + first 2 sentences.
 */

const revealInput = z.object({
  month: z.coerce.number().int().min(1).max(12),
  day: z.coerce.number().int().min(1).max(31),
});

/** Month/day from the form → "MM-DD", or null when it's not a real calendar day (02-29 allowed). */
export function parseRevealInput(input: unknown): MonthDay | null {
  const parsed = revealInput.safeParse(input);
  if (!parsed.success) return null;
  const md = `${String(parsed.data.month).padStart(2, "0")}-${String(parsed.data.day).padStart(2, "0")}`;
  return isMonthDay(md) ? md : null;
}

export type LandingReveal = {
  sign: { code: string; nameMn: string; startMd: string; endMd: string };
  period: number;
  title: string | null;
  teaser: string | null;
  excerpt: string | null;
};

export async function revealBirthday(db: AppDb, md: MonthDay): Promise<LandingReveal> {
  const refs = await loadAstroRefs(db);
  // Any leap year works: only the month-day matters for sign, period and content key.
  const { sign, period } = describeBirthDate(`2000-${md}`, refs);
  const preview = await getPreview(db, BIRTHDAY_PRODUCT, { [BIRTHDAY_PART]: md });
  const main = preview.sections[0];
  return {
    sign,
    period: period.no,
    title: main?.title || null,
    teaser: main?.teaser ?? null,
    excerpt: main?.excerpt ?? null,
  };
}
