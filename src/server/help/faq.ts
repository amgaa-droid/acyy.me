import { asc, eq, max } from "drizzle-orm";
import { z } from "zod";

import { logAudit } from "@/server/audit";
import { faqEntries } from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";

/**
 * Frequently asked questions (/help, managed at /admin/faq by Owner/Editor). Published ones show
 * on the help screen in `sort` order, answer near-identical chat questions without the AI, and
 * are part of the assistant's knowledge.
 */

export type FaqEntry = typeof faqEntries.$inferSelect;
export type PublicFaq = Pick<FaqEntry, "id" | "question" | "answer">;

export const FAQ_LIMITS = { question: 200, answer: 2000 } as const;

export class FaqError extends Error {
  constructor(readonly code: "not_found") {
    super(code);
  }
}

const faqInputSchema = z.object({
  question: z.string().trim().min(3).max(FAQ_LIMITS.question),
  answer: z.string().trim().min(3).max(FAQ_LIMITS.answer),
  isPublished: z.boolean().default(true),
});
const faqUpdateSchema = faqInputSchema.extend({ id: z.uuid() });

const order = [asc(faqEntries.sort), asc(faqEntries.createdAt)];

export async function listFaqs(db: AppDb): Promise<FaqEntry[]> {
  return db
    .select()
    .from(faqEntries)
    .orderBy(...order);
}

export async function listPublishedFaqs(db: AppDb): Promise<PublicFaq[]> {
  return db
    .select({ id: faqEntries.id, question: faqEntries.question, answer: faqEntries.answer })
    .from(faqEntries)
    .where(eq(faqEntries.isPublished, true))
    .orderBy(...order);
}

export async function createFaq(db: AppDb, actorId: string, input: unknown): Promise<FaqEntry> {
  const data = faqInputSchema.parse(input);
  return db.transaction(async (tx) => {
    const [{ last }] = await tx.select({ last: max(faqEntries.sort) }).from(faqEntries);
    const [row] = await tx
      .insert(faqEntries)
      .values({ ...data, sort: (last ?? 0) + 1, updatedBy: actorId })
      .returning();
    await logAudit(tx, {
      actorId,
      action: "faq.create",
      entity: "faq_entries",
      entityId: row.id,
      data,
    });
    return row;
  });
}

export async function updateFaq(db: AppDb, actorId: string, input: unknown): Promise<FaqEntry> {
  const { id, ...data } = faqUpdateSchema.parse(input);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(faqEntries)
      .set({ ...data, updatedBy: actorId })
      .where(eq(faqEntries.id, id))
      .returning();
    if (!row) throw new FaqError("not_found");
    await logAudit(tx, {
      actorId,
      action: "faq.update",
      entity: "faq_entries",
      entityId: id,
      data,
    });
    return row;
  });
}

export async function deleteFaq(db: AppDb, actorId: string, id: string): Promise<void> {
  if (!z.uuid().safeParse(id).success) throw new FaqError("not_found");
  await db.transaction(async (tx) => {
    const [row] = await tx.delete(faqEntries).where(eq(faqEntries.id, id)).returning();
    if (!row) throw new FaqError("not_found");
    await logAudit(tx, {
      actorId,
      action: "faq.delete",
      entity: "faq_entries",
      entityId: id,
      data: { question: row.question },
    });
  });
}

/** Swaps the entry with its neighbour above (`up`) or below. At the edge: nothing happens. */
export async function moveFaq(
  db: AppDb,
  actorId: string,
  id: string,
  direction: "up" | "down",
): Promise<void> {
  if (!z.uuid().safeParse(id).success) throw new FaqError("not_found");
  await db.transaction(async (tx) => {
    // Renumber first: equal sorts (e.g. two seeded together) would make a swap a no-op.
    const all = await tx
      .select({ id: faqEntries.id, sort: faqEntries.sort })
      .from(faqEntries)
      .orderBy(...order);
    const i = all.findIndex((r) => r.id === id);
    if (i < 0) throw new FaqError("not_found");
    const j = direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= all.length) return;
    [all[i], all[j]] = [all[j], all[i]];
    for (const [n, r] of all.entries())
      if (r.sort !== n + 1)
        await tx
          .update(faqEntries)
          .set({ sort: n + 1 })
          .where(eq(faqEntries.id, r.id));
    await logAudit(tx, {
      actorId,
      action: "faq.move",
      entity: "faq_entries",
      entityId: id,
      data: { direction },
    });
  });
}
