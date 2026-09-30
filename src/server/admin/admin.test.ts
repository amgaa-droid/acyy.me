import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildPlaceholderPeriods } from "@/server/astro/calendar";
import { auditLogs, periods48, products, zodiacSigns } from "@/server/db/schema";
import { ZODIAC_SIGNS } from "@/server/db/seed-data";
import type { AppDb } from "@/server/db/types";
import { createTestDb, insertUser } from "@/test/db";
import { CoverageError, savePeriodRanges, saveSignRanges, updateProduct } from "./catalog";
import {
  UnknownContentKeyError,
  contentCoverage,
  listContent,
  listQuerySchema,
  missingKeys,
  saveContentEntry,
} from "./content";

let db: AppDb;
let close: () => Promise<void>;
let actor: string;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  actor = (await insertUser(db, "editor@test.local")).id;
});
afterAll(() => close());

const entry = {
  product: "sign" as const,
  section: "main" as const,
  key: "leo",
  title: "Арслан",
  body: "Текст.",
  score: "",
  status: "published" as const,
};

describe("content admin", () => {
  it("coverage starts empty and counts saved texts", async () => {
    const before = await contentCoverage(db);
    expect(before.find((r) => r.product === "birthday")).toMatchObject({
      expected: 366,
      missing: 366,
    });
    expect(before.find((r) => r.section === "period_pair")).toMatchObject({ expected: 1176 });

    await saveContentEntry(db, actor, entry);
    await saveContentEntry(db, actor, { ...entry, key: "aries", status: "draft" });
    const sign = (await contentCoverage(db)).find((r) => r.product === "sign")!;
    expect(sign).toMatchObject({
      expected: 12,
      published: 1,
      draft: 1,
      missing: 10,
      placeholder: 0,
    });
    await saveContentEntry(db, actor, { ...entry, key: "virgo", title: "[Placeholder] Охин" });
    expect((await contentCoverage(db)).find((r) => r.product === "sign")?.placeholder).toBe(1);
    expect(await missingKeys(db, "sign", "main")).not.toContain("leo");
  });

  it("save is an upsert by key and writes an audit entry", async () => {
    const row = await saveContentEntry(db, actor, { ...entry, title: "Арслан 2", score: "80" });
    expect(row).toMatchObject({ key: "leo", title: "Арслан 2", score: 80 });
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, "content.save"));
    expect(logs.length).toBeGreaterThanOrEqual(3);
  });

  it("rejects unknown keys and empty bodies", async () => {
    await expect(saveContentEntry(db, actor, { ...entry, key: "dragon" })).rejects.toBeInstanceOf(
      UnknownContentKeyError,
    );
    await expect(saveContentEntry(db, actor, { ...entry, body: "  " })).rejects.toThrow();
  });

  it("lists with search and status filter", async () => {
    const q = (o: object) => listContent(db, listQuerySchema.parse({ product: "sign", ...o }));
    expect((await q({})).total).toBe(3);
    expect((await q({ status: "draft" })).items.map((i) => i.key)).toEqual(["aries"]);
    expect((await q({ q: "Арслан 2" })).items.map((i) => i.key)).toEqual(["leo"]);
    expect((await q({ q: "%" })).total).toBe(0);
  });
});

describe("ranges", () => {
  it("saves valid sign ranges and refuses gaps", async () => {
    const moved = ZODIAC_SIGNS.map((s) =>
      s.code === "aries"
        ? { ...s, endMd: "04-20" }
        : s.code === "taurus"
          ? { ...s, startMd: "04-21" }
          : s,
    );
    await saveSignRanges(db, actor, moved);
    const [taurus] = await db.select().from(zodiacSigns).where(eq(zodiacSigns.code, "taurus"));
    expect(taurus.startMd).toBe("04-21");

    const gap = ZODIAC_SIGNS.map((s) => (s.code === "leo" ? { ...s, endMd: "08-20" } : s));
    await expect(saveSignRanges(db, actor, gap)).rejects.toBeInstanceOf(CoverageError);
    await expect(
      saveSignRanges(db, actor, [{ code: "x", startMd: "01-01", endMd: "12-31" }]),
    ).rejects.toThrow();
  });

  it("saves 48 periods only when complete and gap-free", async () => {
    const good = buildPlaceholderPeriods().map((p) => ({ ...p, label: `P${p.no}` }));
    await savePeriodRanges(db, actor, good);
    expect((await db.select().from(periods48)).find((p) => p.no === 5)?.label).toBe("P5");

    await expect(savePeriodRanges(db, actor, good.slice(0, 47))).rejects.toThrow();
    const overlap = good.map((p) => (p.no === 2 ? { ...p, startMd: "01-02" } : p));
    await expect(savePeriodRanges(db, actor, overlap)).rejects.toBeInstanceOf(CoverageError);
  });
});

describe("products", () => {
  it("updates price and flags with an audit trail", async () => {
    const after = await updateProduct(db, actor, {
      code: "love",
      price: 1500,
      isActive: false,
      adultOnly: false,
      allowedGroups: ["self", "romantic"],
    });
    expect(after).toMatchObject({
      price: 1500,
      isActive: false,
      allowedGroups: ["self", "romantic"],
    });
    const [log] = await db.select().from(auditLogs).where(eq(auditLogs.action, "product.update"));
    expect(log.data).toMatchObject({ before: { price: 1000 }, after: { price: 1500 } });
    await expect(
      updateProduct(db, actor, {
        code: "love",
        price: -1,
        isActive: true,
        adultOnly: false,
        allowedGroups: ["self"],
      }),
    ).rejects.toThrow();
    await expect(
      updateProduct(db, actor, {
        code: "love",
        price: 1,
        isActive: true,
        adultOnly: false,
        allowedGroups: [],
      }),
    ).rejects.toThrow();
    const [p] = await db.select().from(products).where(eq(products.code, "love"));
    expect(p.price).toBe(1500);
  });
});
