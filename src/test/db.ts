import { eq } from "drizzle-orm";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import type { AppDb } from "@/server/db/types";
import * as schema from "@/server/db/schema";
import { ZODIAC_SIGNS, catalogRows, placeholderContentRows } from "@/server/db/seed-data";
import { buildPlaceholderPeriods } from "@/server/astro/calendar";

/** Fresh in-memory Postgres (PGlite) with all migrations and reference data applied. */
export async function createTestDb(
  opts: { withContent?: boolean } = {},
): Promise<{ db: AppDb; close: () => Promise<void> }> {
  const client = new PGlite();
  const db = drizzle(client, { schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder: "./drizzle" });
  await db.insert(schema.zodiacSigns).values(ZODIAC_SIGNS);
  await db.insert(schema.periods48).values(buildPlaceholderPeriods());
  const catalog = catalogRows();
  await db.insert(schema.products).values(catalog.products);
  await db.insert(schema.productParts).values(catalog.parts);
  await db.insert(schema.productFields).values(catalog.fields);
  if (opts.withContent) {
    const rows = placeholderContentRows();
    for (let i = 0; i < rows.length; i += 500)
      await db.insert(schema.contentEntries).values(rows.slice(i, i + 500));
  }
  return { db: db as unknown as AppDb, close: () => client.close() };
}

export async function insertUser(db: AppDb, email: string) {
  const [u] = await db
    .insert(schema.user)
    .values({ name: email.split("@")[0], email, emailVerified: true })
    .returning();
  return u;
}

/** The wallet-sheet offer for the seeded package with this price (a made-up id if none). */
export async function offerFor(db: AppDb, amount: number) {
  const [p] = await db
    .select()
    .from(schema.topupPackages)
    .where(eq(schema.topupPackages.amount, amount));
  return p
    ? { packageId: p.id, amount: p.amount, bonus: p.bonus }
    : { packageId: "00000000-0000-4000-8000-000000000000", amount, bonus: 0 };
}
