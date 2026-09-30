import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { walletEntries, wallets } from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";
import { createTestDb, insertUser } from "@/test/db";
import {
  InsufficientFundsError,
  adjust,
  credit,
  debit,
  getBalance,
  ledgerSum,
  listEntries,
} from "./wallet";

let db: AppDb;
let close: () => Promise<void>;
let seq = 0;
const newUser = async () => (await insertUser(db, `w${++seq}@test.local`)).id;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(() => close());

describe("credit / debit", () => {
  it("starts at 0 and keeps balance_after in step with the ledger", async () => {
    const u = await newUser();
    expect(await getBalance(db, u)).toBe(0);
    await credit(db, "topup", { userId: u, amount: 10_000, idempotencyKey: `t-${u}` });
    await credit(db, "bonus", { userId: u, amount: 1_000, idempotencyKey: `b-${u}` });
    const d = await debit(db, "purchase", {
      userId: u,
      amount: 2_000,
      idempotencyKey: `p-${u}`,
      refType: "purchase",
      refId: "x",
    });
    expect(d).toMatchObject({ balance: 9_000, duplicate: false });
    expect(d.entry).toMatchObject({ amount: -2_000, balanceAfter: 9_000, type: "purchase" });
    expect(await getBalance(db, u)).toBe(9_000);
    expect(await ledgerSum(db, u)).toBe(9_000);
    expect((await listEntries(db, u)).map((e) => e.amount)).toEqual([-2_000, 1_000, 10_000]);
  });

  it("insufficient funds throws and changes nothing", async () => {
    const u = await newUser();
    await credit(db, "topup", { userId: u, amount: 1_000, idempotencyKey: `t-${u}` });
    const err = await debit(db, "purchase", {
      userId: u,
      amount: 1_001,
      idempotencyKey: `p-${u}`,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(InsufficientFundsError);
    expect(err).toMatchObject({ balance: 1_000, required: 1_001 });
    expect(await getBalance(db, u)).toBe(1_000);
    expect(await db.select().from(walletEntries).where(eq(walletEntries.userId, u))).toHaveLength(
      1,
    );
    // Exact balance can be spent down to 0.
    expect(
      (await debit(db, "purchase", { userId: u, amount: 1_000, idempotencyKey: `p2-${u}` }))
        .balance,
    ).toBe(0);
  });

  it("replaying an idempotency key is a no-op that returns the first entry", async () => {
    const u = await newUser();
    const first = await credit(db, "topup", {
      userId: u,
      amount: 5_000,
      idempotencyKey: `qpay:${u}`,
    });
    const again = await credit(db, "topup", {
      userId: u,
      amount: 5_000,
      idempotencyKey: `qpay:${u}`,
    });
    expect(again.duplicate).toBe(true);
    expect(again.entry.id).toBe(first.entry.id);
    expect(await getBalance(db, u)).toBe(5_000);
    const d1 = await debit(db, "purchase", {
      userId: u,
      amount: 1_000,
      idempotencyKey: `buy:${u}`,
    });
    const d2 = await debit(db, "purchase", {
      userId: u,
      amount: 1_000,
      idempotencyKey: `buy:${u}`,
    });
    expect(d2).toMatchObject({ duplicate: true, balance: 4_000 });
    expect(d2.entry.id).toBe(d1.entry.id);
  });

  it("a key used by another user is refused", async () => {
    const a = await newUser();
    const b = await newUser();
    await credit(db, "topup", { userId: a, amount: 100, idempotencyKey: `shared-${a}` });
    await expect(
      credit(db, "topup", { userId: b, amount: 100, idempotencyKey: `shared-${a}` }),
    ).rejects.toThrow();
    expect(await getBalance(db, b)).toBe(0);
  });

  it.each([0, -5, 1.5, Number.NaN, 10_000_001])("rejects amount %s", async (amount) => {
    const u = await newUser();
    await expect(
      credit(db, "topup", { userId: u, amount, idempotencyKey: `k-${u}` }),
    ).rejects.toThrow();
    await expect(
      debit(db, "purchase", { userId: u, amount, idempotencyKey: `k2-${u}` }),
    ).rejects.toThrow();
  });

  it("the database itself refuses a negative balance", async () => {
    const u = await newUser();
    await credit(db, "topup", { userId: u, amount: 10, idempotencyKey: `t-${u}` });
    await expect(
      db.update(wallets).set({ balance: -1 }).where(eq(wallets.userId, u)),
    ).rejects.toThrow();
  });
});

describe("adjust (Owner)", () => {
  it("credits or debits with a reason and records who did it", async () => {
    const u = await newUser();
    const owner = await newUser();
    await adjust(db, {
      userId: u,
      amount: 3_000,
      reason: "QPay алдаа",
      idempotencyKey: `adj1-${u}`,
      createdBy: owner,
    });
    const r = await adjust(db, {
      userId: u,
      amount: -500,
      reason: "Буцаалт засвар",
      idempotencyKey: `adj2-${u}`,
      createdBy: owner,
    });
    expect(r.entry).toMatchObject({
      type: "adjust",
      amount: -500,
      note: "Буцаалт засвар",
      createdBy: owner,
    });
    expect(await getBalance(db, u)).toBe(2_500);
    await expect(
      adjust(db, {
        userId: u,
        amount: 100,
        reason: "",
        idempotencyKey: `adj3-${u}`,
        createdBy: owner,
      }),
    ).rejects.toThrow();
    await expect(
      adjust(db, {
        userId: u,
        amount: -10_000,
        reason: "Хэт их",
        idempotencyKey: `adj4-${u}`,
        createdBy: owner,
      }),
    ).rejects.toBeInstanceOf(InsufficientFundsError);
  });
});
