import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import EmbeddedPostgres from "embedded-postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import * as schema from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";

/**
 * A real PostgreSQL 16 server for tests that need true concurrency (row locks, unique races).
 * Uses TEST_DATABASE_URL if set (e.g. docker compose), otherwise starts an embedded server
 * in a temp dir. Set SKIP_PG_TESTS=1 to skip.
 */
export async function startRealPostgres(
  poolSize = 20,
): Promise<{ db: AppDb; stop: () => Promise<void> }> {
  if (process.env.TEST_DATABASE_URL) {
    const client = postgres(process.env.TEST_DATABASE_URL, { max: poolSize, onnotice: () => {} });
    const db = drizzle(client, { schema, casing: "snake_case" });
    await migrate(db, { migrationsFolder: "./drizzle" });
    return { db: db as unknown as AppDb, stop: () => client.end() };
  }

  const dir = await mkdtemp(path.join(tmpdir(), "zurkhai-pg-"));
  const port = 55_000 + Math.floor(Math.random() * 5_000);
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: "postgres",
    password: "postgres",
    port,
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("test");

  const client = postgres(`postgres://postgres:postgres@127.0.0.1:${port}/test`, {
    max: poolSize,
    onnotice: () => {},
  });
  const db = drizzle(client, { schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder: "./drizzle" });

  return {
    db: db as unknown as AppDb,
    stop: async () => {
      await client.end();
      await pg.stop();
      await rm(dir, { recursive: true, force: true });
    },
  };
}
