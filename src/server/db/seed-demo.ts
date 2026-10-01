/**
 * Demo activity for the admin dashboard — DEV ONLY: `pnpm db:seed:demo [--reset] [--users=80] [--days=90]`.
 * See src/server/db/demo-activity.ts. Refuses to run in production, and on PGlite while the dev
 * server is running (see assertNoDevServerOnPglite).
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { demoUserCount, resetDemoActivity, seedDemoActivity } from "./demo-activity";
import { assertNoDevServerOnPglite } from "./dev-cleanup";
import * as schema from "./schema";
import type { AppDb } from "./types";

try {
  process.loadEnvFile();
} catch {
  // .env is optional
}

if (process.env.NODE_ENV === "production") throw new Error("db:seed:demo is dev-only.");
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const client = postgres(url, { max: 1, onnotice: () => {} });
const db = drizzle(client, { schema, casing: "snake_case" }) as unknown as AppDb;

async function main() {
  await assertNoDevServerOnPglite(db);
  if (process.argv.includes("--reset")) {
    console.log(`Removed ${await resetDemoActivity(db)} demo users.`);
  } else if (await demoUserCount(db)) {
    console.log("Demo data already present — run with --reset to recreate it.");
    return;
  }
  const started = Date.now();
  const s = await seedDemoActivity(db, {
    users: Number(arg("users") ?? 80),
    days: Number(arg("days") ?? 90),
    seed: Number(arg("seed") ?? 42),
  });
  console.log(
    `Demo: ${s.users} users, ${s.topups} paid top-ups (+${s.abandoned} abandoned), ` +
      `${s.purchases} purchases, ${s.previews} free previews — ${((Date.now() - started) / 1000).toFixed(1)}s.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => client.end());
