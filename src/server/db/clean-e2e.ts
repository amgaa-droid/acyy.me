/**
 * DEV ONLY: `pnpm db:clean:e2e` — deletes the accounts the E2E suite signed up
 * (`*@test.local` except the seeded test accounts) and everything they own.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { assertNoDevServerOnPglite, cleanE2eUsers } from "./dev-cleanup";
import * as schema from "./schema";
import type { AppDb } from "./types";

try {
  process.loadEnvFile();
} catch {
  // .env is optional
}

if (process.env.NODE_ENV === "production") throw new Error("db:clean:e2e is dev-only.");
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const client = postgres(url, { max: 1, onnotice: () => {} });
const db = drizzle(client, { schema, casing: "snake_case" }) as unknown as AppDb;

async function main() {
  await assertNoDevServerOnPglite(db);
  console.log(`Removed ${await cleanE2eUsers(db)} E2E users and their data.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => client.end());
