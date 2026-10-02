import { eq } from "drizzle-orm";

import { account } from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";

/** The sign-in providers already linked to this user ("google", "facebook", "credential", …). */
export async function linkedProviders(db: AppDb, userId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ providerId: account.providerId })
    .from(account)
    .where(eq(account.userId, userId));
  return rows.map((r) => r.providerId);
}
