import { and, eq } from "drizzle-orm";

import { dayLabel, todayIso } from "@/lib/daily";
import { firstSentences } from "@/lib/preview";
import { getSign } from "@/server/astro/zodiac";
import type { AstroRefs } from "@/server/astro/refs";
import { listDailyKinds } from "@/server/daily";
import { dailyEntries } from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";

/**
 * The landing's "daily horoscope" teaser (SPEC §3.2): today's text of the first active kind for
 * every sign, cut to its first 2 sentences — the full texts are read in the app after sign-in.
 */

export type LandingDaily = {
  /** "10-р сарын 3, Баасан" (Mongolia time). */
  dayLabel: string;
  /** The sign whose season today falls in — selected first. */
  todaySign: string;
  signs: { code: string; name: string }[];
  /** Active kinds, in order; the first one's text is the one excerpted. */
  kinds: { code: string; name: string; icon: string; tint: string }[];
  /** Sign code → excerpt (null = not written for today yet). */
  excerpts: Record<string, string | null>;
};

export async function landingDaily(
  db: AppDb,
  refs: AstroRefs,
  date: string = todayIso(),
): Promise<LandingDaily | null> {
  const kinds = await listDailyKinds(db, { activeOnly: true });
  if (kinds.length === 0) return null;
  const rows = await db
    .select({ sign: dailyEntries.signCode, text: dailyEntries.text })
    .from(dailyEntries)
    .where(and(eq(dailyEntries.kindCode, kinds[0].code), eq(dailyEntries.date, date)));
  const text = new Map(rows.map((r) => [r.sign, r.text]));
  return {
    dayLabel: dayLabel(date),
    todaySign: getSign(date, refs.signs).code,
    signs: refs.signs.map((s) => ({ code: s.code, name: s.nameMn })),
    kinds: kinds.map((k) => ({ code: k.code, name: k.nameMn, icon: k.icon, tint: k.tint })),
    excerpts: Object.fromEntries(
      refs.signs.map((s) => {
        const t = text.get(s.code);
        return [s.code, t ? firstSentences(t, 2) : null];
      }),
    ),
  };
}
