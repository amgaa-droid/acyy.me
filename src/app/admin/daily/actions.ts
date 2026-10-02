"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin, requireOwner } from "@/server/admin/guard";
import { DailyError, createDailyKind, saveDailyTexts, updateDailyKind } from "@/server/daily";
import { db } from "@/server/db";

export type DailyResult =
  | { ok: true; saved?: number; cleared?: number }
  | { ok: false; error: DailyError["code"] | "invalid" | "generic" };

async function run(
  fn: () => Promise<{ saved?: number; cleared?: number } | void>,
): Promise<DailyResult> {
  try {
    const res = await fn();
    revalidatePath("/admin/daily");
    // Home's "today" view reads these texts.
    revalidatePath("/home");
    return { ok: true, ...res };
  } catch (err) {
    if (err instanceof DailyError) return { ok: false, error: err.code };
    if (err instanceof z.ZodError) return { ok: false, error: "invalid" };
    console.error("[admin:daily]", err);
    return { ok: false, error: "generic" };
  }
}

/** Texts: Editor or Owner. */
export async function saveDailyTextsAction(input: unknown): Promise<DailyResult> {
  const admin = await requireAdmin();
  return run(() => saveDailyTexts(db, admin.userId, input as never));
}

/** Kinds (what daily horoscopes exist): Owner, like the product catalogue. */
export async function createDailyKindAction(input: unknown): Promise<DailyResult> {
  const admin = await requireOwner();
  return run(async () => {
    await createDailyKind(db, admin.userId, input as never);
  });
}

export async function updateDailyKindAction(input: unknown): Promise<DailyResult> {
  const admin = await requireOwner();
  return run(async () => {
    await updateDailyKind(db, admin.userId, input as never);
  });
}
