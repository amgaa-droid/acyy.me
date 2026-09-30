import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import type { AppDb } from "@/server/db/types";
import * as schema from "@/server/db/schema";
import { PRODUCTS, ZODIAC_SIGNS, placeholderContentRows } from "@/server/db/seed-data";
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
  await db.insert(schema.products).values(PRODUCTS.map((p, i) => ({ ...p, sort: i + 1 })));
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
