import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import type * as schema from "./schema";

/**
 * Any Drizzle Postgres database with our schema (postgres-js in the app, PGlite in tests).
 * Server functions take it as a parameter so they are testable against a real SQL engine.
 */
export type AppDb = PgDatabase<PgQueryResultHKT, typeof schema>;
