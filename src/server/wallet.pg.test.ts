import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { products, user, walletEntries } from "@/server/db/schema";
import { PRODUCTS } from "@/server/db/seed-data";
import { MockQPayProvider } from "@/server/qpay/mock";
import { createTopup, settleTopup } from "@/server/topups";
import { contentEntries, purchases } from "@/server/db/schema";
import { placeholderContentRows } from "@/server/db/seed-data";
import { createPerson, createSelf } from "@/server/persons";
import { purchase } from "@/server/purchase";
import { ZODIAC_SIGNS } from "@/server/db/seed-data";
import { buildPlaceholderPeriods } from "@/server/astro/calendar";
import { periods48, zodiacSigns } from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";
import { startRealPostgres } from "@/test/real-pg";
import { InsufficientFundsError, credit, debit, getBalance, ledgerSum } from "./wallet";

/** Concurrency on a REAL PostgreSQL (PHASES C5): row locks and unique-key races. */
describe.skipIf(process.env.SKIP_PG_TESTS === "1")("wallet on real Postgres", () => {
  let db: AppDb;
  let stop: () => Promise<void>;

  beforeAll(async () => {
    ({ db, stop } = await startRealPostgres(20));
  }, 120_000);
  afterAll(async () => stop?.(), 60_000);

  const newUser = async (email: string) =>
    (await db.insert(user).values({ name: email, email, emailVerified: true }).returning())[0].id;

  it("100 concurrent debits never overdraw: exactly balance/amount succeed", async () => {
    const u = await newUser("race@test.local");
    await credit(db, "topup", { userId: u, amount: 5_000, idempotencyKey: `seed-${u}` });

    const results = await Promise.allSettled(
      Array.from({ length: 100 }, (_, i) =>
        debit(db, "purchase", { userId: u, amount: 100, idempotencyKey: `race-${u}-${i}` }),
      ),
    );
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");

    expect(ok).toHaveLength(50);
    expect(failed).toHaveLength(50);
    for (const f of failed)
      expect((f as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientFundsError);
    expect(await getBalance(db, u)).toBe(0);
    expect(await ledgerSum(db, u)).toBe(0);

    const entries = await db.select().from(walletEntries).where(eq(walletEntries.userId, u));
    expect(entries).toHaveLength(51);
    expect(Math.min(...entries.map((e) => e.balanceAfter))).toBe(0);
    // balance_after values of the debits are 4900, 4800, … 0 — each exactly once.
    const after = entries
      .filter((e) => e.type === "purchase")
      .map((e) => e.balanceAfter)
      .sort((a, b) => a - b);
    expect(after).toEqual(Array.from({ length: 50 }, (_, i) => i * 100));
  }, 60_000);

  it("the same idempotency key sent 20 times at once is applied once", async () => {
    const u = await newUser("dup@test.local");
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        credit(db, "topup", { userId: u, amount: 10_000, idempotencyKey: `qpay:payment-${u}` }),
      ),
    );
    expect(results.filter((r) => !r.duplicate)).toHaveLength(1);
    expect(new Set(results.map((r) => r.entry.id)).size).toBe(1);
    expect(await getBalance(db, u)).toBe(10_000);
    expect(await db.select().from(walletEntries).where(eq(walletEntries.userId, u))).toHaveLength(
      1,
    );
  }, 60_000);

  it("mixed concurrent credits and debits keep wallet == ledger", async () => {
    const u = await newUser("mix@test.local");
    await credit(db, "topup", { userId: u, amount: 1_000, idempotencyKey: `seed-${u}` });
    await Promise.allSettled(
      Array.from({ length: 60 }, (_, i) =>
        i % 3 === 0
          ? credit(db, "bonus", { userId: u, amount: 300, idempotencyKey: `c-${u}-${i}` })
          : debit(db, "purchase", { userId: u, amount: 200, idempotencyKey: `d-${u}-${i}` }),
      ),
    );
    const balance = await getBalance(db, u);
    expect(balance).toBeGreaterThanOrEqual(0);
    expect(await ledgerSum(db, u)).toBe(balance);
  }, 60_000);

  it("10 concurrent callbacks for one paid top-up credit exactly once", async () => {
    await db
      .insert(products)
      .values(PRODUCTS.map((p, i) => ({ ...p, sort: i })))
      .onConflictDoNothing();
    const u = await newUser("cb@test.local");
    const qpay = new MockQPayProvider("http://localhost:3000");
    const t = await createTopup(db, qpay, {
      userId: u,
      amount: 10_000,
      appUrl: "http://localhost:3000",
      callbackSecret: "s".repeat(64),
      description: "test",
    });
    qpay.markPaid(t.invoiceId!);
    const results = await Promise.all(
      Array.from({ length: 10 }, () => settleTopup(db, qpay, t.id, { source: "callback" })),
    );
    expect(results.every((r) => r.status === "paid")).toBe(true);
    expect(results.filter((r) => r.credited)).toHaveLength(1);
    expect(await getBalance(db, u)).toBe(11_000);
    expect(await ledgerSum(db, u)).toBe(11_000);
  }, 60_000);

  it("10 concurrent purchases of the same reading (incl. B×A) charge once", async () => {
    await db
      .insert(products)
      .values(PRODUCTS.map((p, i) => ({ ...p, sort: i })))
      .onConflictDoNothing();
    await db.insert(zodiacSigns).values(ZODIAC_SIGNS).onConflictDoNothing();
    await db.insert(periods48).values(buildPlaceholderPeriods()).onConflictDoNothing();
    const rows = placeholderContentRows();
    for (let i = 0; i < rows.length; i += 500) {
      await db
        .insert(contentEntries)
        .values(rows.slice(i, i + 500))
        .onConflictDoNothing();
    }
    const u = await newUser("buyer@test.local");
    const self = await createSelf(db, u, {
      name: "Би",
      birthDate: "1990-05-05",
      avatarSeed: "Nova",
    });
    const mom = await createPerson(db, u, {
      name: "Ээж",
      birthDate: "1965-02-02",
      avatarSeed: "Iris",
      relation: "mother",
    });
    await credit(db, "topup", { userId: u, amount: 5_000, idempotencyKey: `seed-${u}` });

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) =>
        purchase(db, {
          userId: u,
          productCode: "synastry",
          personIds: i % 2 ? [self.id, mom.id] : [mom.id, self.id],
        }),
      ),
    );
    const ok = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<
      Awaited<ReturnType<typeof purchase>>
    >[];
    expect(ok).toHaveLength(10);
    expect(new Set(ok.map((r) => r.value.purchase.id)).size).toBe(1);
    expect(ok.filter((r) => !r.value.alreadyOwned)).toHaveLength(1);
    expect(await db.select().from(purchases).where(eq(purchases.userId, u))).toHaveLength(1);
    expect(await getBalance(db, u)).toBe(4_000);
    expect(await ledgerSum(db, u)).toBe(4_000);
  }, 60_000);
});
