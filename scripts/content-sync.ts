/**
 * Moves the catalogue and its content between databases — not users, purchases or money.
 *
 *   pnpm tsx scripts/content-sync.ts export <file.json>   # from the database in DATABASE_URL
 *   pnpm tsx scripts/content-sync.ts import <file.json>   # into the database in DATABASE_URL
 *
 * Tables: zodiac signs, 48 periods, products/parts/fields, texts, daily horoscope kinds and texts,
 * top-up packages, landing page versions and draft, FAQ, assistant notes, app settings.
 * "Who edited" columns are dropped (those users don't exist on the other side).
 * API keys saved on /admin/ai are sealed with SETTINGS_ENCRYPTION_KEY: export opens them with
 * this side's key and import seals them again with the other side's, so the file holds them in
 * plain text — keep it private (chmod 600) and delete it after the import.
 * Import replaces these tables wholesale and refuses a database that already has purchases or
 * top-ups (deleting products or packages would break them).
 */
import { readFile, writeFile } from "node:fs/promises";
import { drizzle } from "drizzle-orm/postgres-js";
import { count } from "drizzle-orm";
import postgres from "postgres";

import * as schema from "@/server/db/schema";
import { openSecret, sealSecret } from "@/server/secret-box";

try {
  process.loadEnvFile();
} catch {
  // .env is optional
}

/** In insert order (parents first); deleted in reverse. */
const TABLES = {
  zodiacSigns: schema.zodiacSigns,
  periods48: schema.periods48,
  products: schema.products,
  productParts: schema.productParts,
  productFields: schema.productFields,
  contentEntries: schema.contentEntries,
  dailyKinds: schema.dailyKinds,
  dailyEntries: schema.dailyEntries,
  topupPackages: schema.topupPackages,
  pageVersions: schema.pageVersions,
  pageDrafts: schema.pageDrafts,
  faqEntries: schema.faqEntries,
  aiKnowledge: schema.aiKnowledge,
  appSettings: schema.appSettings,
} as const;
type TableName = keyof typeof TABLES;
type Row = Record<string, unknown>;
type Dump = { exportedAt: string; tables: Record<TableName, Row[]> };

const EDITOR_COLUMNS = ["updatedBy", "publishedBy"];
const SEALED = /^v1\./;

/** Sealed API keys inside a settings value (`{ keys: { provider: { sealed, hint } } }`). */
function mapSealed(value: unknown, fn: (s: string) => string): unknown {
  const v = value as { keys?: Record<string, { sealed?: string } | null> } | null;
  if (!v?.keys) return value;
  const keys = Object.fromEntries(
    Object.entries(v.keys).map(([k, entry]) => [
      k,
      entry && typeof entry.sealed === "string" ? { ...entry, sealed: fn(entry.sealed) } : entry,
    ]),
  );
  return { ...v, keys };
}

function dropKeys(value: unknown): unknown {
  const v = value as { keys?: Record<string, unknown> } | null;
  return v?.keys
    ? { ...v, keys: Object.fromEntries(Object.keys(v.keys).map((k) => [k, null])) }
    : value;
}

function revive(row: Row): Row {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [
      k,
      typeof v === "string" && /At$/.test(k) ? new Date(v) : v,
    ]),
  );
}

async function main() {
  const [mode, file] = process.argv.slice(2);
  if ((mode !== "export" && mode !== "import") || !file) {
    throw new Error("usage: content-sync.ts export|import <file.json>");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const key = process.env.SETTINGS_ENCRYPTION_KEY || undefined;
  const client = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(client, { schema, casing: "snake_case" });

  try {
    if (mode === "export") {
      const tables = {} as Dump["tables"];
      for (const [name, table] of Object.entries(TABLES) as [
        TableName,
        (typeof TABLES)[TableName],
      ][]) {
        const rows = (await db.select().from(table)) as Row[];
        tables[name] = rows.map((r) => {
          const out: Row = { ...r };
          for (const c of EDITOR_COLUMNS) if (c in out) out[c] = null;
          if (name === "appSettings") {
            out.value = mapSealed(out.value, (s) => (SEALED.test(s) ? openSecret(s, key) : s));
          }
          return out;
        });
      }
      await writeFile(file, JSON.stringify({ exportedAt: new Date().toISOString(), tables }), {
        mode: 0o600,
      });
      for (const [n, rows] of Object.entries(tables)) console.log(n.padEnd(16), rows.length);
      return;
    }

    const dump = JSON.parse(await readFile(file, "utf8")) as Dump;
    const [[{ bought }], [{ paid }]] = await Promise.all([
      db.select({ bought: count() }).from(schema.purchases),
      db.select({ paid: count() }).from(schema.topups),
    ]);
    if (bought > 0 || paid > 0) {
      throw new Error(`refusing: the database already has ${bought} purchases, ${paid} top-ups`);
    }
    const names = Object.keys(TABLES) as TableName[];
    await db.transaction(async (tx) => {
      for (const name of [...names].reverse()) await tx.delete(TABLES[name]);
      for (const name of names) {
        const rows = (dump.tables[name] ?? []).map((r) => {
          const row = revive(r);
          if (name === "appSettings") {
            // A key that can't be sealed here is dropped; it is entered again on /admin/ai.
            row.value = key ? mapSealed(row.value, (s) => sealSecret(s, key)) : dropKeys(row.value);
          }
          return row;
        });
        for (let i = 0; i < rows.length; i += 500) {
          await tx.insert(TABLES[name]).values(rows.slice(i, i + 500) as never);
        }
        console.log(name.padEnd(16), rows.length);
      }
    });
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
