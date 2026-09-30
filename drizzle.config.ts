import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile();
} catch {
  // .env is optional; DATABASE_URL may come from the environment.
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
  verbose: true,
});
