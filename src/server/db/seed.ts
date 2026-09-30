/**
 * Idempotent seed: `pnpm db:seed`.
 * Reference data (zodiac, periods48, products) is upserted; placeholder content is inserted
 * only where a key is missing, so real imported texts are never overwritten.
 */
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { todayYmd } from "@/lib/birth-date";
import { buildPlaceholderPeriods } from "@/server/astro/calendar";
import * as schema from "./schema";
import { PRODUCTS, ZODIAC_SIGNS, placeholderContentRows } from "./seed-data";
import { seedTestUsers } from "./seed-users";
import type { AppDb } from "./types";

try {
  process.loadEnvFile();
} catch {
  // .env is optional
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const client = postgres(url, { max: 1, onnotice: () => {} });
const db = drizzle(client, { schema, casing: "snake_case" });

const excluded = (col: string) => sql.raw(`excluded.${col}`);

async function main() {
  await db.transaction(async (tx) => {
    await tx
      .insert(schema.zodiacSigns)
      .values(ZODIAC_SIGNS)
      .onConflictDoUpdate({
        target: schema.zodiacSigns.code,
        set: {
          nameMn: excluded("name_mn"),
          startMd: excluded("start_md"),
          endMd: excluded("end_md"),
          sort: excluded("sort"),
        },
      });

    // Periods: only fill if empty — real ranges come from the admin import and must not be reset.
    const [{ count: periodCount }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.periods48);
    if (periodCount === 0) await tx.insert(schema.periods48).values(buildPlaceholderPeriods());

    // Products: insert new ones, keep admin-edited price/flags on re-seed.
    await tx
      .insert(schema.products)
      .values(PRODUCTS.map((p, i) => ({ ...p, sort: i + 1 })))
      .onConflictDoNothing({ target: schema.products.code });

    const rows = placeholderContentRows();
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const res = await tx
        .insert(schema.contentEntries)
        .values(rows.slice(i, i + 500))
        .onConflictDoNothing()
        .returning({ id: schema.contentEntries.id });
      inserted += res.length;
    }

    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.contentEntries);
    console.log(
      `Seeded: ${ZODIAC_SIGNS.length} signs, 48 periods, ${PRODUCTS.length} products, ` +
        `content +${inserted} (total ${total}).`,
    );
  });

  // Test accounts: dev/staging only, and only when SEED_PASSWORD is set.
  const password = process.env.SEED_PASSWORD;
  if (process.env.NODE_ENV === "production") {
    console.log("Skipping test accounts in production.");
  } else if (!password) {
    console.log("SEED_PASSWORD not set — skipping test accounts.");
  } else {
    const created = await seedTestUsers(db as unknown as AppDb, password, todayYmd());
    console.log(`Test accounts: ${created.length ? created.join(", ") : "already present"}.`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => client.end());
