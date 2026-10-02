import net from "node:net";

import { and, inArray, like, notInArray } from "drizzle-orm";

import { todayYmd } from "@/lib/birth-date";

import {
  account,
  invitations,
  persons,
  previewViews,
  purchases,
  session,
  topups,
  user,
  verification,
  walletEntries,
  wallets,
} from "./schema";
import { testAccounts } from "./seed-users";
import type { AppDb } from "./types";

/**
 * DEV ONLY: hard-deletes users and everything they own, money records included — for throwaway
 * accounts (demo seed, E2E sign-ups). Real accounts are anonymized instead (SPEC: account deletion).
 */
export async function deleteUsersAndData(db: AppDb, ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  await db.transaction(async (tx) => {
    const emails = (
      await tx.select({ email: user.email }).from(user).where(inArray(user.id, ids))
    ).map((u) => u.email);
    await tx.delete(purchases).where(inArray(purchases.userId, ids));
    await tx.delete(previewViews).where(inArray(previewViews.userId, ids));
    await tx.delete(walletEntries).where(inArray(walletEntries.userId, ids));
    // Ledger rows of other users that one of these accounts wrote (admin adjustments).
    await tx
      .update(walletEntries)
      .set({ createdBy: null })
      .where(inArray(walletEntries.createdBy, ids));
    await tx.delete(wallets).where(inArray(wallets.userId, ids));
    await tx.delete(topups).where(inArray(topups.userId, ids));
    await tx.delete(invitations).where(inArray(invitations.inviterUserId, ids));
    await tx.delete(persons).where(inArray(persons.ownerUserId, ids));
    await tx.delete(session).where(inArray(session.userId, ids));
    await tx.delete(account).where(inArray(account.userId, ids));
    // Pending sign-in OTPs are keyed by email, not by user id.
    for (const email of emails) {
      await tx.delete(verification).where(like(verification.identifier, `%${email}`));
    }
    await tx.delete(user).where(inArray(user.id, ids));
  });
  return ids.length;
}

/**
 * Accounts the E2E suite signed up (`<prefix>-<time>-<rand>@test.local`): every `@test.local`
 * user except the seeded test accounts (owner/editor/user/minor), which E2E logs in with.
 */
export async function e2eUserIds(db: AppDb): Promise<string[]> {
  const seeded = testAccounts(todayYmd()).map((a) => a.email);
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(and(like(user.email, "%@test.local"), notInArray(user.email, seeded)));
  return rows.map((r) => r.id);
}

export async function cleanE2eUsers(db: AppDb): Promise<number> {
  return deleteUsersAndData(db, await e2eUserIds(db));
}

/**
 * Dev scripts delete or invent users and money records, and NODE_ENV says nothing when a script
 * is run by hand: they only talk to a database on this machine (`--remote` overrides).
 */
export function assertLocalDatabase(url: string, argv = process.argv) {
  if (argv.includes("--remote")) return;
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(host)) {
    throw new Error(`Refusing to run a dev-only script against ${host} (pass --remote to force).`);
  }
}

/** Whether something accepts TCP connections on localhost:`port`. */
export function portInUse(port: number, timeoutMs = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "localhost", port });
    const done = (v: boolean) => {
      socket.destroy();
      resolve(v);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}

/** True when the database is PGlite (`pnpm db:local`). */
export async function isPglite(db: AppDb): Promise<boolean> {
  const rows = await db.execute<{ version: string }>(`select version() as version`);
  // postgres-js returns the rows; PGlite (tests) returns { rows }.
  const first = Array.isArray(rows) ? rows[0] : (rows as { rows: { version: string }[] }).rows[0];
  return String(first?.version ?? "").includes("PGlite");
}

/**
 * `pnpm db:local` (pglite-socket) multiplexes every client onto ONE Postgres session, so another
 * client's queries interleave with a script's mid-statement ("bind message supplies 8 parameters,
 * but prepared statement requires 1") or land inside its transactions. Dev scripts refuse to run
 * while the dev server — the usual other client — is up.
 */
export async function assertNoDevServerOnPglite(db: AppDb, argv = process.argv) {
  if (argv.includes("--force") || !(await isPglite(db))) return;
  const port = Number(process.env.PORT ?? 3000);
  // A listening port is enough: a busy (compiling) dev server may be slow to answer HTTP.
  const up = await portInUse(port);
  if (up) {
    console.error(
      `The dev server on :${port} shares the PGlite database (one session for all clients), so ` +
        "running this now would interleave with its queries. Stop it, run this again, then " +
        "restart `pnpm dev`. (--force skips this check.)",
    );
    process.exit(2);
  }
}
