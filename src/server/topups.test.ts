import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { auditLogs, topups, walletEntries } from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";
import { MockQPayProvider } from "@/server/qpay/mock";
import { verifyTopupSignature } from "@/server/qpay/signature";
import { createTestDb, insertUser, offerFor } from "@/test/db";
import {
  InvalidTierError,
  TopupNotFoundError,
  callbackUrl,
  checkPendingTopups,
  createTopup,
  getTopupForUser,
  settleTopup,
} from "./topups";
import { getBalance } from "./wallet";

const SECRET = "x".repeat(64);
const APP = "http://localhost:3000";
let db: AppDb;
let close: () => Promise<void>;
let seq = 0;
const newUser = async () => (await insertUser(db, `t${++seq}@test.local`)).id;
const opts = async (userId: string, amount: number) => ({
  userId,
  offer: await offerFor(db, amount),
  appUrl: APP,
  callbackSecret: SECRET,
  description: "Хэтэвч цэнэглэх",
});

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(() => close());

describe("createTopup", () => {
  it("only allows configured tiers", async () => {
    const qpay = new MockQPayProvider(APP);
    await expect(createTopup(db, qpay, await opts(await newUser(), 3_000))).rejects.toBeInstanceOf(
      InvalidTierError,
    );
  });

  it("stores the invoice and a signed callback URL", async () => {
    const qpay = new MockQPayProvider(APP);
    const t = await createTopup(db, qpay, await opts(await newUser(), 10_000));
    expect(t).toMatchObject({ amount: 10_000, bonus: 1_000, status: "pending", provider: "mock" });
    expect(t.invoiceId).toBe(`mock_${t.id}`);
    expect(t.invoiceData?.qrImage).toMatch(/^data:image\/png;base64,/);
    const cb = new URL(qpay.get(t.invoiceId!)!.callbackUrl);
    expect(cb.pathname).toBe("/api/qpay/callback");
    expect(verifyTopupSignature(t.id, cb.searchParams.get("sig")!, SECRET)).toBe(true);
    expect(verifyTopupSignature(t.id, cb.searchParams.get("sig")!, "other")).toBe(false);
    expect(verifyTopupSignature(t.id, "nope", SECRET)).toBe(false);
  });
});

describe("settleTopup", () => {
  it("10,000₮ top-up credits 11,000 (amount + bonus as separate entries)", async () => {
    const qpay = new MockQPayProvider(APP);
    const u = await newUser();
    const t = await createTopup(db, qpay, await opts(u, 10_000));

    expect(await settleTopup(db, qpay, t.id, { source: "callback" })).toEqual({
      status: "pending",
      credited: false,
    });
    expect(await getBalance(db, u)).toBe(0);

    qpay.markPaid(t.invoiceId!);
    expect(await settleTopup(db, qpay, t.id, { source: "callback" })).toEqual({
      status: "paid",
      credited: true,
    });
    expect(await getBalance(db, u)).toBe(11_000);
    const entries = await db.select().from(walletEntries).where(eq(walletEntries.userId, u));
    expect(entries.map((e) => [e.type, e.amount]).sort()).toEqual([
      ["bonus", 1_000],
      ["topup", 10_000],
    ]);
    const [row] = await db.select().from(topups).where(eq(topups.id, t.id));
    expect(row).toMatchObject({ status: "paid", paymentId: `mockpay_${t.invoiceId}` });
    expect(row.paidAt).toBeInstanceOf(Date);
  });

  it("calling the callback twice (or concurrently) credits once", async () => {
    const qpay = new MockQPayProvider(APP);
    const u = await newUser();
    const t = await createTopup(db, qpay, await opts(u, 5_000));
    qpay.markPaid(t.invoiceId!);
    await Promise.all([
      settleTopup(db, qpay, t.id, { source: "callback" }),
      settleTopup(db, qpay, t.id, { source: "callback" }),
    ]);
    await settleTopup(db, qpay, t.id, { source: "callback" });
    await settleTopup(db, qpay, t.id, { source: "cron" });
    expect(await getBalance(db, u)).toBe(5_300);
  });

  it("an amount mismatch marks the top-up failed and credits nothing", async () => {
    const qpay = new MockQPayProvider(APP);
    const u = await newUser();
    const t = await createTopup(db, qpay, await opts(u, 20_000));
    qpay.markPaid(t.invoiceId!, 2_000);
    expect(await settleTopup(db, qpay, t.id, { source: "callback" })).toEqual({
      status: "failed",
      credited: false,
    });
    expect(await getBalance(db, u)).toBe(0);
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, t.id));
    expect(logs[0]).toMatchObject({ action: "topup.amount_mismatch" });
  });

  it("unknown or malformed ids are not found", async () => {
    const qpay = new MockQPayProvider(APP);
    await expect(settleTopup(db, qpay, "nope")).rejects.toBeInstanceOf(TopupNotFoundError);
    await expect(settleTopup(db, qpay, crypto.randomUUID())).rejects.toBeInstanceOf(
      TopupNotFoundError,
    );
  });
});

describe("checkPendingTopups (cron)", () => {
  it("credits paid invoices without any callback and expires old unpaid ones", async () => {
    const qpay = new MockQPayProvider(APP);
    const u = await newUser();
    const paid = await createTopup(db, qpay, await opts(u, 2_000));
    const stale = await createTopup(db, qpay, await opts(u, 5_000));
    const fresh = await createTopup(db, qpay, await opts(u, 10_000));
    await db
      .update(topups)
      .set({ createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })
      .where(eq(topups.id, stale.id));
    qpay.markPaid(paid.invoiceId!);

    const summary = await checkPendingTopups(db, qpay);
    expect(summary.paid).toBeGreaterThanOrEqual(1);
    expect(summary.expired).toBeGreaterThanOrEqual(1);
    expect(await getBalance(db, u)).toBe(2_000);

    const status = async (id: string) =>
      (await db.select().from(topups).where(eq(topups.id, id)))[0].status;
    expect(await status(paid.id)).toBe("paid");
    expect(await status(stale.id)).toBe("expired");
    expect(await status(fresh.id)).toBe("pending");

    // A late payment on an expired invoice is still honoured on re-check.
    qpay.markPaid(stale.invoiceId!);
    expect((await settleTopup(db, qpay, stale.id, { source: "admin" })).status).toBe("paid");
    expect(await getBalance(db, u)).toBe(7_300);
  });

  it("leaves what doesn't fit its time budget to the next run", async () => {
    const qpay = new MockQPayProvider(APP);
    const u = await newUser();
    const t = await createTopup(db, qpay, await opts(u, 2_000));
    qpay.markPaid(t.invoiceId!);

    const none = await checkPendingTopups(db, qpay, new Date(), 0);
    expect(none.checked).toBe(0);
    expect(none.skipped).toBeGreaterThanOrEqual(1);
    expect(await getBalance(db, u)).toBe(0);

    expect((await checkPendingTopups(db, qpay)).skipped).toBe(0);
    expect(await getBalance(db, u)).toBe(2_000);
  });
});

describe("getTopupForUser", () => {
  it("hides other users' top-ups", async () => {
    const qpay = new MockQPayProvider(APP);
    const a = await newUser();
    const b = await newUser();
    const t = await createTopup(db, qpay, await opts(a, 2_000));
    expect((await getTopupForUser(db, a, t.id)).id).toBe(t.id);
    await expect(getTopupForUser(db, b, t.id)).rejects.toBeInstanceOf(TopupNotFoundError);
  });
});

describe("callbackUrl", () => {
  it("builds an absolute URL on APP_URL", () => {
    const u = new URL(callbackUrl("https://2-28-197-187.sslip.io", "abc", SECRET));
    expect(u.origin).toBe("https://2-28-197-187.sslip.io");
    expect(u.searchParams.get("topup_id")).toBe("abc");
  });
});
