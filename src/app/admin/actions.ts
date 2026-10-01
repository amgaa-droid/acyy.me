"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin, requireOwner } from "@/server/admin/guard";
import {
  CatalogError,
  CoverageError,
  addField,
  addPart,
  createProduct,
  deleteField,
  deletePart,
  deleteProduct,
  moveItem,
  savePeriodRanges,
  saveSignRanges,
  setFieldArchived,
  setPartArchived,
  updateField,
  updatePart,
  updateProduct,
} from "@/server/admin/catalog";
import {
  MissingFieldsError,
  UnknownContentKeyError,
  saveContentEntry,
} from "@/server/admin/content";
import type { CoverageIssue } from "@/server/astro/coverage";
import { db } from "@/server/db";
import { findKind } from "@/server/import/kinds";
import { loadProductDefs } from "@/server/products";
import { runImport } from "@/server/import/run";
import { logAudit } from "@/server/audit";
import { qpay } from "@/server/qpay";
import { PackageError, createPackage, deletePackage, updatePackage } from "@/server/topup-packages";
import { TopupNotFoundError, settleTopup } from "@/server/topups";
import { InsufficientFundsError, adjust } from "@/server/wallet";
import type { ImportError } from "@/server/import/validate";

// ---------- Content ----------

export async function saveContentAction(
  input: unknown,
): Promise<
  | { ok: true; id: string }
  | { ok: false; error: "unknown_key" | "missing_fields" | "invalid" | "generic" }
> {
  const admin = await requireAdmin();
  try {
    const row = await saveContentEntry(db, admin.userId, input as never);
    revalidatePath("/admin/content");
    revalidatePath("/admin");
    return { ok: true, id: row.id };
  } catch (err) {
    if (err instanceof UnknownContentKeyError) return { ok: false, error: "unknown_key" };
    if (err instanceof MissingFieldsError) return { ok: false, error: "missing_fields" };
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

export type CatalogResult =
  | { ok: true; missing?: number }
  | { ok: false; error: CatalogError["code"] | "invalid" | "generic" };

async function catalogAction(
  fn: (actorId: string) => Promise<{ missing?: number } | void>,
  code?: string,
): Promise<CatalogResult> {
  const admin = await requireOwner();
  try {
    const res = await fn(admin.userId);
    revalidatePath("/admin/products");
    if (code) revalidatePath(`/admin/products/${code}`);
    revalidatePath("/admin");
    return { ok: true, ...(res ?? {}) };
  } catch (err) {
    if (err instanceof CatalogError) return { ok: false, error: err.code };
    if (err instanceof z.ZodError) return { ok: false, error: "invalid" };
    console.error("[admin:products]", err);
    return { ok: false, error: "generic" };
  }
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const productOf = (input: unknown) => str((input as { productCode?: unknown })?.productCode);

export async function createProductAction(input: unknown): Promise<CatalogResult> {
  return catalogAction((actor) => createProduct(db, actor, input as never).then(() => {}));
}

export async function updateProductAction(input: unknown): Promise<CatalogResult> {
  const code = str((input as { code?: unknown })?.code);
  return catalogAction(async (actor) => {
    const { missing } = await updateProduct(db, actor, input as never);
    return { missing };
  }, code);
}

export async function deleteProductAction(code: string): Promise<CatalogResult> {
  return catalogAction((actor) => deleteProduct(db, actor, code));
}

export async function addPartAction(input: unknown): Promise<CatalogResult> {
  return catalogAction((actor) => addPart(db, actor, input as never), productOf(input));
}

export async function updatePartAction(input: unknown): Promise<CatalogResult> {
  return catalogAction((actor) => updatePart(db, actor, input as never), productOf(input));
}

export async function deletePartAction(input: {
  productCode: string;
  partCode: string;
  confirm?: boolean;
}): Promise<CatalogResult> {
  return catalogAction((actor) => deletePart(db, actor, input), input.productCode);
}

export async function archivePartAction(input: {
  productCode: string;
  partCode: string;
  archived: boolean;
}): Promise<CatalogResult> {
  return catalogAction((actor) => setPartArchived(db, actor, input), input.productCode);
}

export async function deleteFieldAction(input: {
  productCode: string;
  partCode: string;
  code: string;
}): Promise<CatalogResult> {
  return catalogAction((actor) => deleteField(db, actor, input), input.productCode);
}

export async function addFieldAction(input: unknown): Promise<CatalogResult> {
  return catalogAction((actor) => addField(db, actor, input as never), productOf(input));
}

export async function updateFieldAction(input: unknown): Promise<CatalogResult> {
  return catalogAction((actor) => updateField(db, actor, input as never), productOf(input));
}

export async function archiveFieldAction(input: {
  productCode: string;
  partCode: string;
  code: string;
  archived: boolean;
}): Promise<CatalogResult> {
  return catalogAction((actor) => setFieldArchived(db, actor, input), input.productCode);
}

export async function moveItemAction(input: {
  productCode: string;
  partCode: string | null;
  code: string;
  dir: "up" | "down";
}): Promise<CatalogResult> {
  return catalogAction((actor) => moveItem(db, actor, input), input.productCode);
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

  const spec = findKind(await loadProductDefs(db), kind);
  if (!spec || !(file instanceof File)) return { ok: false, error: "badFile" };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { ok: false, error: "badFile" };
  if (file.size > MAX_FILE) return { ok: false, error: "tooBig" };

  try {
    const res = await runImport(db, {
      spec,
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

// ---------- Money (Owner) ----------

export async function adjustWalletAction(input: {
  userId: string;
  amount: number;
  reason: string;
  idempotencyKey: string;
}): Promise<{ ok: true } | { ok: false; error: "invalid" | "insufficient" | "generic" }> {
  const admin = await requireOwner();
  try {
    await db.transaction(async (tx) => {
      const res = await adjust(tx as unknown as typeof db, { ...input, createdBy: admin.userId });
      if (!res.duplicate) {
        await logAudit(tx, {
          actorId: admin.userId,
          action: "wallet.adjust",
          entity: "wallets",
          entityId: input.userId,
          data: { amount: input.amount, reason: input.reason, entryId: res.entry.id },
        });
      }
    });
    revalidatePath(`/admin/users/${input.userId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof InsufficientFundsError) return { ok: false, error: "insufficient" };
    if (err instanceof z.ZodError) return { ok: false, error: "invalid" };
    console.error("[admin:adjust]", err);
    return { ok: false, error: "generic" };
  }
}

export async function recheckTopupAction(id: string): Promise<{ status: string }> {
  const admin = await requireOwner();
  try {
    const res = await settleTopup(db, qpay(), id, { source: "admin", actorId: admin.userId });
    revalidatePath("/admin/topups");
    return { status: res.status };
  } catch (err) {
    if (err instanceof TopupNotFoundError) return { status: "not_found" };
    console.error("[admin:recheck]", err);
    return { status: "error" };
  }
}

// ---------- Top-up packages (Owner) ----------

export type PackageResult =
  { ok: true } | { ok: false; error: PackageError["code"] | "invalid" | "generic" };

async function packageAction(fn: (actorId: string) => Promise<unknown>): Promise<PackageResult> {
  const admin = await requireOwner();
  try {
    await fn(admin.userId);
    revalidatePath("/admin/packages");
    revalidatePath("/admin");
    // The wallet sheet (app layout) and the landing page list the active packages.
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    if (err instanceof PackageError) return { ok: false, error: err.code };
    if (err instanceof z.ZodError) return { ok: false, error: "invalid" };
    console.error("[admin:packages]", err);
    return { ok: false, error: "generic" };
  }
}

export async function createPackageAction(input: unknown): Promise<PackageResult> {
  return packageAction((actor) => createPackage(db, actor, input));
}

export async function updatePackageAction(input: unknown): Promise<PackageResult> {
  return packageAction((actor) => updatePackage(db, actor, input));
}

export async function deletePackageAction(id: string): Promise<PackageResult> {
  return packageAction((actor) => deletePackage(db, actor, id));
}
