import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/env";
import * as schema from "./schema";
export type { AppDb } from "./types";

const globalForDb = globalThis as unknown as { pgClient?: postgres.Sql };

// Reuse the connection across dev hot reloads.
const client =
  globalForDb.pgClient ??
  postgres(env().DATABASE_URL, { max: env().DATABASE_POOL_MAX, onnotice: () => {} });
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
