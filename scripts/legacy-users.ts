/**
 * Old acyy.me accounts → this app (src/server/legacy). Dry run by default.
 *
 *   pnpm tsx scripts/legacy-users.ts [--commit] [--limit N] [--only <legacyUserId>]
 *       [--dump OldDB/alldata.sql] [--logins OldDB/onlyAspnetuserslogin.sql]
 *       [--plan-out plan.json] [--plan-in plan.json]
 *
 * Reading the dumps takes ~1.5 GB of memory, so on a small server: plan where the dumps are
 * (`--plan-out`, writes the planned accounts — personal data, chmod 600), copy the file over and
 * apply it there (`--plan-in … --commit`), which needs no dumps. Delete the file afterwards.
 *
 * Reads the SQL Server dumps (kept out of git), plans every account (users with a Facebook
 * login who paid for a reading or hold a balance), prints a report and — with --commit —
 * writes them. Safe to re-run: existing accounts, people and readings are left as they are,
 * and the balance is credited once (idempotency key "legacy:balance:{id}").
 * A JSON report goes to OldDB/export/legacy-users-report.json.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { todayYmd, toIsoDate } from "@/lib/birth-date";
import { loadAstroRefs } from "@/server/astro/refs";
import * as schema from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";
import {
  LegacyProductMissingError,
  applyLegacyUser,
  type ApplyResult,
} from "@/server/legacy/apply";
import { readDump } from "@/server/legacy/mssql";
import { planLegacyUsers, type LegacyPlan } from "@/server/legacy/users";
import { loadProductDefs } from "@/server/products";

try {
  process.loadEnvFile();
} catch {
  // .env is optional
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const count = <T>(xs: T[], key: (x: T) => string) =>
  xs.reduce<Record<string, number>>((m, x) => ((m[key(x)] = (m[key(x)] ?? 0) + 1), m), {});

async function main() {
  const commit = process.argv.includes("--commit");
  const limit = arg("limit") ? Number(arg("limit")) : Infinity;
  const only = arg("only") ? Number(arg("only")) : null;
  const dumpPath = arg("dump") ?? "OldDB/alldata.sql";
  const loginsPath = arg("logins") ?? "OldDB/onlyAspnetuserslogin.sql";

  const planIn = arg("plan-in");
  const planOut = arg("plan-out");
  let plan: LegacyPlan;
  type Source = { users: number; logins: number };
  let source: Source = { users: 0, logins: 0 };
  if (planIn) {
    ({ plan, source } = JSON.parse(await readFile(planIn, "utf8")) as {
      plan: LegacyPlan;
      source: Source;
    });
  } else {
    console.time("read dumps");
    const [data, logins] = await Promise.all([
      readDump(dumpPath, ["Users", "acyyUserAction", "acyyRelation", "acyyChargeHistory"]),
      readDump(loginsPath, ["AspNetUserLogins"]),
    ]);
    console.timeEnd("read dumps");
    source = { users: data.Users.length, logins: logins.AspNetUserLogins.length };
    plan = planLegacyUsers(
      {
        users: data.Users,
        logins: logins.AspNetUserLogins,
        actions: data.acyyUserAction,
        relations: data.acyyRelation,
        charges: data.acyyChargeHistory,
      },
      toIsoDate(todayYmd()),
    );
  }
  if (planOut) {
    await writeFile(planOut, JSON.stringify({ plan, source }), { mode: 0o600 });
    console.log(`plan → ${planOut}`);
  }
  const users = plan.users.filter((u) => only === null || u.legacyUserId === only).slice(0, limit);

  const summary = {
    sourceUsers: source.users,
    facebookLogins: source.logins,
    plannedUsers: plan.users.length,
    selected: users.length,
    people: users.reduce((n, u) => n + u.people.length, 0),
    purchases: count(
      users.flatMap((u) => u.purchases),
      (p) => p.product,
    ),
    balanceUsers: users.filter((u) => u.balance > 0).length,
    balanceTotal: users.reduce((n, u) => n + u.balance, 0),
    placeholderEmails: users.filter((u) => u.email.endsWith("@facebook.invalid")).length,
    skipped: count(plan.skipped, (s) => s.reason),
  };
  console.log(JSON.stringify(summary, null, 2));

  // One account's bad data must not stop the run: it is reported and the next one goes on.
  type Outcome = ApplyResult | { ok: false; reason: "error"; message: string };
  const results: { legacyUserId: number; result: Outcome }[] = [];
  if (commit) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    const client = postgres(url, { max: 1, onnotice: () => {} });
    const db = drizzle(client, { schema, casing: "snake_case" }) as unknown as AppDb;
    const defs = await loadProductDefs(db);
    const ctx = { refs: await loadAstroRefs(db), products: new Map(defs.map((d) => [d.code, d])) };

    console.time("apply");
    for (const [i, u] of users.entries()) {
      let result: Outcome;
      try {
        result = await applyLegacyUser(db, u, ctx);
      } catch (err) {
        if (err instanceof LegacyProductMissingError) throw err; // nothing can be applied
        result = {
          ok: false,
          reason: "error",
          message: err instanceof Error ? err.message : String(err),
        };
      }
      results.push({ legacyUserId: u.legacyUserId, result });
      if ((i + 1) % 500 === 0) console.log(`  ${i + 1} / ${users.length}`);
    }
    console.timeEnd("apply");
    await client.end();

    const ok = results.flatMap((r) => (r.result.ok ? [r.result] : []));
    console.log(
      JSON.stringify(
        {
          applied: ok.length,
          createdUsers: ok.filter((r) => r.createdUser).length,
          newPeople: ok.reduce((n, r) => n + r.newPeople, 0),
          newPurchases: ok.reduce((n, r) => n + r.newPurchases, 0),
          credited: ok.reduce((n, r) => n + r.credited, 0),
          conflicts: count(
            results.filter((r) => !r.result.ok),
            (r) => (r.result.ok ? "" : r.result.reason),
          ),
        },
        null,
        2,
      ),
    );
  } else {
    console.log("Dry run — nothing written. Add --commit to apply.");
  }

  const out = path.resolve(arg("report") ?? "OldDB/export/legacy-users-report.json");
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(
    out,
    JSON.stringify(
      { summary, skipped: plan.skipped, conflicts: results.filter((r) => !r.result.ok) },
      null,
      1,
    ),
  );
  console.log(`report → ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
