import { asc, eq, max } from "drizzle-orm";
import { z } from "zod";

import { logAudit } from "@/server/audit";
import { aiKnowledge } from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";

/**
 * What admins teach the help assistant by hand (/admin/ai/knowledge, Owner): a title and plain
 * text each. Active notes join the built-in knowledge; when they disagree, the notes win.
 */

export type KnowledgeNote = typeof aiKnowledge.$inferSelect;

export const NOTE_LIMITS = { title: 120, body: 6000 } as const;

export class NoteError extends Error {
  constructor(readonly code: "not_found") {
    super(code);
  }
}

const noteInputSchema = z.object({
  title: z.string().trim().min(2).max(NOTE_LIMITS.title),
  body: z.string().trim().min(2).max(NOTE_LIMITS.body),
  isActive: z.boolean().default(true),
});
const noteUpdateSchema = noteInputSchema.extend({ id: z.uuid() });

const order = [asc(aiKnowledge.sort), asc(aiKnowledge.createdAt)];

export async function listNotes(db: AppDb): Promise<KnowledgeNote[]> {
  return db
    .select()
    .from(aiKnowledge)
    .orderBy(...order);
}

export async function listActiveNotes(db: AppDb) {
  return db
    .select({ id: aiKnowledge.id, title: aiKnowledge.title, body: aiKnowledge.body })
    .from(aiKnowledge)
    .where(eq(aiKnowledge.isActive, true))
    .orderBy(...order);
}

export async function createNote(db: AppDb, actorId: string, input: unknown) {
  const data = noteInputSchema.parse(input);
  return db.transaction(async (tx) => {
    const [{ last }] = await tx.select({ last: max(aiKnowledge.sort) }).from(aiKnowledge);
    const [row] = await tx
      .insert(aiKnowledge)
      .values({ ...data, sort: (last ?? 0) + 1, updatedBy: actorId })
      .returning();
    await logAudit(tx, {
      actorId,
      action: "ai_knowledge.create",
      entity: "ai_knowledge",
      entityId: row.id,
      data: { title: data.title, isActive: data.isActive },
    });
    return row;
  });
}

export async function updateNote(db: AppDb, actorId: string, input: unknown) {
  const { id, ...data } = noteUpdateSchema.parse(input);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(aiKnowledge)
      .set({ ...data, updatedBy: actorId })
      .where(eq(aiKnowledge.id, id))
      .returning();
    if (!row) throw new NoteError("not_found");
    await logAudit(tx, {
      actorId,
      action: "ai_knowledge.update",
      entity: "ai_knowledge",
      entityId: id,
      data: { title: data.title, isActive: data.isActive },
    });
    return row;
  });
}

export async function deleteNote(db: AppDb, actorId: string, id: string): Promise<void> {
  if (!z.uuid().safeParse(id).success) throw new NoteError("not_found");
  await db.transaction(async (tx) => {
    const [row] = await tx.delete(aiKnowledge).where(eq(aiKnowledge.id, id)).returning();
    if (!row) throw new NoteError("not_found");
    await logAudit(tx, {
      actorId,
      action: "ai_knowledge.delete",
      entity: "ai_knowledge",
      entityId: id,
      data: { title: row.title },
    });
  });
}
