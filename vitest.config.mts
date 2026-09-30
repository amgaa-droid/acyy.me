import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // PGlite / embedded Postgres start-up + migrations can take a while when files run in parallel.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
