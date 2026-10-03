import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { topups, user } from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";
import { createTestDb } from "@/test/db";
import { searchUsers } from "./users";

let db: AppDb;
let close: () => Promise<void>;

const day = (d: number) => new Date(Date.UTC(2026, 8, d, 4));

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  const rows = await db
    .insert(user)
    .values(
      ["ann", "bat", "chuka", "dulmaa"].map((name, i) => ({
        name,
        email: `${name}@test.local`,
        emailVerified: true,
        createdAt: day(i + 1),
      })),
    )
    .returning();
  const id = Object.fromEntries(rows.map((r) => [r.name, r.id]));
  await db.insert(topups).values([
    // ann: two paid top-ups — the latest one counts.
    { userId: id.ann, amount: 5000, status: "paid", provider: "mock", paidAt: day(10) },
    { userId: id.ann, amount: 5000, status: "paid", provider: "mock", paidAt: day(20) },
    // bat: paid earlier than ann's latest.
    { userId: id.bat, amount: 5000, status: "paid", provider: "mock", paidAt: day(15) },
    // chuka: only an unpaid invoice — counts as never topped up.
    { userId: id.chuka, amount: 5000, status: "pending", provider: "mock" },
  ]);
});
afterAll(() => close());

const names = async (q: Parameters<typeof searchUsers>[1]) =>
  (await searchUsers(db, q)).map((r) => r.name);

describe("searchUsers", () => {
  it("sorts by join date, newest first by default", async () => {
    expect(await names({})).toEqual(["dulmaa", "chuka", "bat", "ann"]);
    expect(await names({ sort: "joined", dir: "asc" })).toEqual(["ann", "bat", "chuka", "dulmaa"]);
  });

  it("sorts by latest paid top-up; never-paid users last either way", async () => {
    expect(await names({ sort: "topup", dir: "desc" })).toEqual(["ann", "bat", "dulmaa", "chuka"]);
    expect(await names({ sort: "topup", dir: "asc" })).toEqual(["bat", "ann", "dulmaa", "chuka"]);
    const [ann] = await searchUsers(db, { q: "ann" });
    expect(new Date(ann.lastTopupAt!).toISOString()).toBe(day(20).toISOString());
  });

  it("ignores bad sort params and still searches", async () => {
    expect(await names({ sort: "x" as never, dir: "y" as never, q: "BAT" })).toEqual(["bat"]);
    expect(await names("chu")).toEqual(["chuka"]);
  });
});
