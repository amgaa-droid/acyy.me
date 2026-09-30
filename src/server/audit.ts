import type { AppDb } from "@/server/db/types";
import { auditLogs } from "@/server/db/schema";

type Tx = Pick<AppDb, "insert">;

/** Append-only audit trail for admin and money actions (SPEC §4.1, §10). */
export async function logAudit(
  db: Tx,
  entry: {
    actorId: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    data?: unknown;
  },
): Promise<void> {
  await db.insert(auditLogs).values({
    actorId: entry.actorId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    data: entry.data ?? null,
  });
}
