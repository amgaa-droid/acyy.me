"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin, requireOwner } from "@/server/admin/guard";
import {
  CoverageError,
  savePeriodRanges,
  saveSignRanges,
  updateProduct,
} from "@/server/admin/catalog";
import { UnknownContentKeyError, saveContentEntry } from "@/server/admin/content";
import type { CoverageIssue } from "@/server/astro/coverage";
import { db } from "@/server/db";
import { IMPORT_KINDS, isImportKind } from "@/server/import/kinds";
import { runImport } from "@/server/import/run";
import type { ImportError } from "@/server/import/validate";

// ---------- Content ----------

export async function saveContentAction(
  input: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: "unknown_key" | "invalid" | "generic" }> {
  const admin = await requireAdmin();
  try {
    const row = await saveContentEntry(db, admin.userId, input as never);
    revalidatePath("/admin/content");
    revalidatePath("/admin");
    return { ok: true, id: row.id };
  } catch (err) {
    if (err instanceof UnknownContentKeyError) return { ok: false, error: "unknown_key" };
    if (err instanceof z.ZodError) return { ok: false, error: "invalid" };
    console.error("[admin:content]", err);
    return { ok: false, error: "generic" };
  }
}

// ---------- Ranges ----------

export type RangesResult =
  { ok: true } | { ok: false; issues: CoverageIssue[] } | { ok: false; error: "invalid" };

async function saveRanges(fn: () => Promise<void>, paths: string[]): Promise<RangesResult> {
  try {
    await fn();
    for (const p of paths) revalidatePath(p);
    return { ok: true };
  } catch (err) {
    if (err instanceof CoverageError) return { ok: false, issues: err.issues };
    if (err instanceof z.ZodError) return { ok: false, error: "invalid" };
    console.error("[admin:ranges]", err);
    return { ok: false, error: "invalid" };
  }
}

export async function saveSignRangesAction(input: unknown): Promise<RangesResult> {
  const admin = await requireAdmin();
  return saveRanges(() => saveSignRanges(db, admin.userId, input), ["/admin/zodiac", "/admin"]);
}

export async function savePeriodRangesAction(input: unknown): Promise<RangesResult> {
  const admin = await requireAdmin();
  return saveRanges(() => savePeriodRanges(db, admin.userId, input), ["/admin/periods", "/admin"]);
}

// ---------- Products (Owner) ----------

export async function updateProductAction(input: unknown): Promise<{ ok: boolean }> {
  const admin = await requireOwner();
  try {
    await updateProduct(db, admin.userId, input as never);
    revalidatePath("/admin/products");
    return { ok: true };
  } catch (err) {
    if (!(err instanceof z.ZodError)) console.error("[admin:products]", err);
    return { ok: false };
  }
}

// ---------- Import ----------

const MAX_FILE = 10 * 1024 * 1024;
const MAX_ERRORS = 200;

export type ImportActionResult =
  | { ok: false; error: "tooBig" | "badFile" | "generic" }
  | {
      ok: true;
      report: {
        valid: boolean;
        committed: boolean;
        rows: number;
        toInsert: number;
        toUpdate: number;
        errors: ImportError[];
        errorCount: number;
        missing: string[];
        mapping: Record<string, string>;
      };
    };

/** Dry-run (commit=0) or import (commit=1). The file is re-validated on commit. */
export async function importAction(formData: FormData): Promise<ImportActionResult> {
  const admin = await requireAdmin();
  const kind = String(formData.get("kind") ?? "");
  const file = formData.get("file");
  const commit = formData.get("commit") === "1";

  if (!isImportKind(kind) || !(file instanceof File)) return { ok: false, error: "badFile" };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { ok: false, error: "badFile" };
  if (file.size > MAX_FILE) return { ok: false, error: "tooBig" };

  try {
    const res = await runImport(db, {
      spec: IMPORT_KINDS[kind],
      file: await file.arrayBuffer(),
      fileName: file.name,
      actorId: admin.userId,
      commit,
    });
    if (res.committed) {
      revalidatePath("/admin");
      revalidatePath("/admin/content");
      revalidatePath("/admin/periods");
    }
    return {
      ok: true,
      report: {
        valid: res.ok,
        committed: res.committed,
        rows: res.rows,
        toInsert: res.toInsert,
        toUpdate: res.toUpdate,
        errors: res.errors.slice(0, MAX_ERRORS),
        errorCount: res.errors.length,
        missing: res.missing,
        mapping: res.mapping,
      },
    };
  } catch (err) {
    console.error("[admin:import]", err);
    return { ok: false, error: "generic" };
  }
}
