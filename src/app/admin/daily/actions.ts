"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin, requireOwner } from "@/server/admin/guard";
import { DailyError, createDailyKind, saveDailyTexts, updateDailyKind } from "@/server/daily";
import { db } from "@/server/db";
import { runDailyImport, type DailyImportError } from "@/server/import/daily";

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

const MAX_FILE = 10 * 1024 * 1024;
const MAX_ERRORS = 200;

export type DailyImportResult =
  | { ok: false; error: "tooBig" | "badFile" | "generic" }
  | {
      ok: true;
      report: {
        valid: boolean;
        committed: boolean;
        rows: number;
        kinds: string[];
        ignoredColumns: string[];
        toInsert: number;
        toUpdate: number;
        unchanged: number;
        from: string | null;
        to: string | null;
        incomplete: { date: string; filled: number; total: number }[];
        errors: DailyImportError[];
        errorCount: number;
      };
    };

/** Excel import of daily texts: dry run (`commit` ≠ "1") or write. Editor or Owner. */
export async function importDailyAction(formData: FormData): Promise<DailyImportResult> {
  const admin = await requireAdmin();
  const file = formData.get("file");
  const commit = formData.get("commit") === "1";
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) {
    return { ok: false, error: "badFile" };
  }
  if (file.size > MAX_FILE) return { ok: false, error: "tooBig" };

  try {
    const res = await runDailyImport(db, {
      file: await file.arrayBuffer(),
      fileName: file.name,
      actorId: admin.userId,
      commit,
    });
    if (res.committed) {
      revalidatePath("/admin/daily");
      revalidatePath("/home");
    }
    return {
      ok: true,
      report: {
        valid: res.ok,
        committed: res.committed,
        rows: res.rows,
        kinds: res.kinds,
        ignoredColumns: res.ignoredColumns,
        toInsert: res.toInsert,
        toUpdate: res.toUpdate,
        unchanged: res.unchanged,
        from: res.from,
        to: res.to,
        incomplete: res.incomplete.slice(0, 62),
        errors: res.errors.slice(0, MAX_ERRORS),
        errorCount: res.errors.length,
      },
    };
  } catch (err) {
    console.error("[admin:daily-import]", err);
    return { ok: false, error: "generic" };
  }
}
