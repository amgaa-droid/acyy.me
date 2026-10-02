import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadAstroRefs, type AstroRefs } from "@/server/astro/refs";
import { dailyEntries, dailyKinds } from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";
import { createTestDb } from "@/test/db";
import { landingDaily } from "./landing-daily";

let db: AppDb;
let close: () => Promise<void>;
let refs: AstroRefs;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  refs = await loadAstroRefs(db);
});
afterAll(() => close());

describe("landingDaily", () => {
  it("excerpts the first active kind's text for today, per sign", async () => {
    await db.insert(dailyEntries).values([
      {
        kindCode: "general",
        date: "2026-10-03",
        signCode: "libra",
        text: "Нэг дэх өгүүлбэр. Хоёр дахь өгүүлбэр! Гурав дахь нь нууц.",
      },
      { kindCode: "general", date: "2026-10-02", signCode: "aries", text: "Өчигдрийнх." },
      { kindCode: "love", date: "2026-10-03", signCode: "aries", text: "Хайрын текст." },
    ]);
    const d = await landingDaily(db, refs, "2026-10-03");
    expect(d).not.toBeNull();
    expect(d!.todaySign).toBe("libra");
    expect(d!.dayLabel).toBe("10-р сарын 3, Бямба");
    expect(d!.kinds.map((k) => k.code)).toEqual(["general", "love", "work"]);
    expect(d!.signs).toHaveLength(12);
    // Only 2 sentences leave the server; other days and other kinds aren't used.
    expect(d!.excerpts.libra).toBe("Нэг дэх өгүүлбэр. Хоёр дахь өгүүлбэр!");
    expect(d!.excerpts.aries).toBeNull();
  });

  it("is null when no daily kind is active", async () => {
    await db.update(dailyKinds).set({ isActive: false });
    expect(await landingDaily(db, refs, "2026-10-03")).toBeNull();
  });
});
