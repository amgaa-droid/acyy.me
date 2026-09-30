"use server";

import { z } from "zod";

import { describeBirthDate, loadAstroRefs } from "@/server/astro/refs";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { SelfAlreadyExistsError, createSelf, selfInputSchema } from "@/server/persons";

export type OnboardingResult =
  | {
      ok: true;
      sign: { code: string; nameMn: string; startMd: string; endMd: string };
      period: { no: number };
    }
  | { ok: false; error: "name" | "birthDate" | "exists" | "generic" };

export async function createSelfAction(input: unknown): Promise<OnboardingResult> {
  const user = await requireUser();

  const parsed = selfInputSchema.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return {
      ok: false,
      error: field === "name" ? "name" : field === "birthDate" ? "birthDate" : "generic",
    };
  }

  try {
    const self = await createSelf(db, user.id, parsed.data);
    const { sign, period } = describeBirthDate(self.birthDate, await loadAstroRefs(db));
    return { ok: true, sign, period: { no: period.no } };
  } catch (err) {
    if (err instanceof SelfAlreadyExistsError) return { ok: false, error: "exists" };
    if (err instanceof z.ZodError) return { ok: false, error: "generic" };
    console.error("[onboarding]", err);
    return { ok: false, error: "generic" };
  }
}
