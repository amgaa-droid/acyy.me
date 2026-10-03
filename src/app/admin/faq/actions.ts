"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/server/admin/guard";
import { db } from "@/server/db";
import { FaqError, createFaq, deleteFaq, moveFaq, updateFaq } from "@/server/help/faq";

export type FaqResult =
  { ok: true } | { ok: false; error: FaqError["code"] | "invalid" | "generic" };

/** FAQ edits (Owner/Editor): content, like the texts. */
async function faqAction(fn: (actorId: string) => Promise<unknown>): Promise<FaqResult> {
  const admin = await requireAdmin();
  try {
    await fn(admin.userId);
    revalidatePath("/admin/faq");
    revalidatePath("/help");
    return { ok: true };
  } catch (err) {
    if (err instanceof FaqError) return { ok: false, error: err.code };
    if (err instanceof z.ZodError) return { ok: false, error: "invalid" };
    console.error("[admin:faq]", err);
    return { ok: false, error: "generic" };
  }
}

export async function createFaqAction(input: unknown): Promise<FaqResult> {
  return faqAction((actor) => createFaq(db, actor, input));
}

export async function updateFaqAction(input: unknown): Promise<FaqResult> {
  return faqAction((actor) => updateFaq(db, actor, input));
}

export async function deleteFaqAction(id: string): Promise<FaqResult> {
  return faqAction((actor) => deleteFaq(db, actor, id));
}

export async function moveFaqAction(id: string, direction: "up" | "down"): Promise<FaqResult> {
  return faqAction((actor) => moveFaq(db, actor, id, direction === "up" ? "up" : "down"));
}
