"use server";

import { db } from "@/server/db";
import { parseRevealInput, revealBirthday, type LandingReveal } from "@/server/landing";

/** Public (no session): the landing page's free birthday reveal. Preview-level content only. */
export async function revealAction(input: {
  month: string;
  day: string;
}): Promise<{ ok: true; reveal: LandingReveal } | { ok: false }> {
  const md = parseRevealInput(input);
  if (!md) return { ok: false };
  return { ok: true, reveal: await revealBirthday(db, md) };
}
