import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { buildPlaceholderPeriods } from "@/server/astro/calendar";
import {
  auditLogs,
  contentEntries,
  periods48,
  products,
  purchases,
  zodiacSigns,
} from "@/server/db/schema";
import { ZODIAC_SIGNS } from "@/server/db/seed-data";
import type { AppDb } from "@/server/db/types";
import { createTestDb, insertUser } from "@/test/db";
import { loadProductDef } from "@/server/products";
import {
  CoverageError,
  addField,
  addPart,
  createProduct,
  deletePart,
  deleteField,
  deleteProduct,
  fieldUsage,
  moveItem,
  partTextCounts,
  savePeriodRanges,
  saveSignRanges,
  setFieldArchived,
  setPartArchived,
  updateField,
  updatePart,
  updateProduct,
} from "./catalog";
import {
  MissingFieldsError,
  PLACEHOLDER_PREFIX,
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
  fields: { general: "Текст." },
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
    const signRow = (await contentCoverage(db)).find((r) => r.product === "sign")!;
    expect(signRow).toMatchObject({
      expected: 12,
      published: 1,
      draft: 1,
      missing: 10,
      placeholder: 0,
    });
    await saveContentEntry(db, actor, { ...entry, key: "virgo", title: "[Placeholder] Охин" });
    expect((await contentCoverage(db)).find((r) => r.product === "sign")?.placeholder).toBe(1);
    const sign = (await loadProductDef(db, "sign"))!.parts[0];
    expect(await missingKeys(db, sign)).not.toContain("leo");
  });

  it("save is an upsert by key and writes an audit entry", async () => {
    const row = await saveContentEntry(db, actor, { ...entry, title: "Арслан 2", score: "80" });
    expect(row).toMatchObject({ key: "leo", title: "Арслан 2", score: 80 });
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, "content.save"));
    expect(logs.length).toBeGreaterThanOrEqual(3);
  });

  it("rejects unknown keys and empty required sub-sections", async () => {
    await expect(saveContentEntry(db, actor, { ...entry, key: "dragon" })).rejects.toBeInstanceOf(
      UnknownContentKeyError,
    );
    await expect(
      saveContentEntry(db, actor, { ...entry, fields: { general: "  " } }),
    ).rejects.toBeInstanceOf(MissingFieldsError);
  });

  it("keeps only the part's fields, and keeps archived values on save", async () => {
    const row = await saveContentEntry(db, actor, {
      ...entry,
      product: "birthday",
      key: "03-21",
      fields: { general: "Ерөнхий.", meditation: "Амгалан.", bogus: "x" },
    });
    expect(row.fields).toEqual({ general: "Ерөнхий.", meditation: "Амгалан." });

    await setFieldArchived(db, actor, {
      productCode: "birthday",
      partCode: "main",
      code: "meditation",
      archived: true,
    });
    const again = await saveContentEntry(db, actor, {
      ...entry,
      product: "birthday",
      key: "03-21",
      fields: { general: "Шинэ.", meditation: "Үл тоогдоно." },
    });
    expect(again.fields).toEqual({ general: "Шинэ.", meditation: "Амгалан." });
    await setFieldArchived(db, actor, {
      productCode: "birthday",
      partCode: "main",
      code: "meditation",
      archived: false,
    });
  });

  it("lists with search and status filter", async () => {
    const q = (o: object) =>
      listContent(db, listQuerySchema.parse({ product: "sign", section: "main", ...o }));
    expect((await q({})).total).toBe(3);
    expect((await q({ status: "draft" })).items.map((i) => i.key)).toEqual(["aries"]);
    expect((await q({ q: "Арслан 2" })).items.map((i) => i.key)).toEqual(["leo"]);
    expect((await q({ q: "%" })).total).toBe(0);
    // Searches inside sub-section texts too.
    expect((await q({ q: "Текст" })).total).toBe(3);
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

const settings = {
  code: "love",
  nameMn: "Хайр дурлалын зурхай",
  description: "",
  price: 1500,
  sort: 3,
  isActive: false,
  adultOnly: false,
  allowedGroups: ["self", "romantic"] as ("self" | "romantic")[],
  icon: "heart" as const,
  tint: "tint-2" as const,
};

describe("products", () => {
  it("updates settings with an audit trail", async () => {
    const { product: after } = await updateProduct(db, actor, settings);
    expect(after).toMatchObject({
      price: 1500,
      isActive: false,
      allowedGroups: ["self", "romantic"],
    });
    const [log] = await db.select().from(auditLogs).where(eq(auditLogs.action, "product.update"));
    expect(log.data).toMatchObject({ before: { price: 1000 }, after: { price: 1500 } });
    await expect(updateProduct(db, actor, { ...settings, price: -1 })).rejects.toThrow();
    await expect(updateProduct(db, actor, { ...settings, allowedGroups: [] })).rejects.toThrow();
    await expect(
      updateProduct(db, actor, { ...settings, icon: "rocket" as never }),
    ).rejects.toThrow();
    const [p] = await db.select().from(products).where(eq(products.code, "love"));
    expect(p.price).toBe(1500);
  });

  it("reports missing texts when activating an incomplete product", async () => {
    const res = await updateProduct(db, actor, { ...settings, isActive: true });
    expect(res.missing).toBe(12);
  });
});

describe("product builder", () => {
  it("creates an inactive product with one part and a required general field", async () => {
    await createProduct(db, actor, {
      code: "career",
      nameMn: "Ажил мэргэжлийн зурхай",
      personCount: 1,
      price: 1200,
      keyType: "sign",
      byGender: true,
    });
    const def = (await loadProductDef(db, "career"))!;
    expect(def).toMatchObject({ isActive: false, price: 1200, personCount: 1 });
    expect(def.parts).toHaveLength(1);
    expect(def.parts[0]).toMatchObject({ code: "main", keyType: "sign", byGender: true });
    expect(def.parts[0].fields.map((f) => [f.code, f.required])).toEqual([["general", true]]);
    expect((await contentCoverage(db)).find((c) => c.product === "career")?.expected).toBe(24);

    await expect(
      createProduct(db, actor, {
        code: "career",
        nameMn: "Давхар",
        personCount: 1,
        price: 0,
        keyType: "sign",
      }),
    ).rejects.toMatchObject({ code: "code_taken" });
    await expect(
      createProduct(db, actor, {
        code: "Bad Code",
        nameMn: "x",
        personCount: 1,
        price: 0,
        keyType: "sign",
      }),
    ).rejects.toThrow();
    await expect(
      createProduct(db, actor, {
        code: "pairish",
        nameMn: "x",
        personCount: 1,
        price: 0,
        keyType: "sign_pair",
      }),
    ).rejects.toMatchObject({ code: "arity_mismatch" });
  });

  it("adds, edits, reorders and archives sub-sections", async () => {
    const ref = { productCode: "career", partCode: "main" };
    await addField(db, actor, {
      ...ref,
      code: "strengths",
      nameMn: "Давуу тал",
      kind: "list",
      isFree: true,
    });
    await addField(db, actor, { ...ref, code: "advice", nameMn: "Зөвлөгөө", kind: "cards" });
    await expect(
      addField(db, actor, { ...ref, code: "advice", nameMn: "Дахин", kind: "text" }),
    ).rejects.toMatchObject({ code: "code_taken" });

    await updateField(db, actor, {
      ...ref,
      code: "advice",
      nameMn: "Зөвлөмж",
      kind: "quote",
      required: true,
    });
    await moveItem(db, actor, { ...ref, code: "strengths", dir: "up" });
    await setFieldArchived(db, actor, { ...ref, code: "advice", archived: true });

    const fields = (await loadProductDef(db, "career"))!.parts[0].fields;
    expect(fields.map((f) => f.code)).toEqual(["strengths", "general", "advice"]);
    expect(fields[2]).toMatchObject({ nameMn: "Зөвлөмж", kind: "quote", required: true });
    expect(fields[2].archivedAt).not.toBeNull();
  });

  it("activates only when every part has a field", async () => {
    await updateProduct(db, actor, { ...settings, code: "career", nameMn: "Ажил", isActive: true });
    await setFieldArchived(db, actor, {
      productCode: "career",
      partCode: "main",
      code: "general",
      archived: true,
    });
    await setFieldArchived(db, actor, {
      productCode: "career",
      partCode: "main",
      code: "strengths",
      archived: true,
    });
    await expect(
      updateProduct(db, actor, { ...settings, code: "career", nameMn: "Ажил", isActive: true }),
    ).rejects.toMatchObject({ code: "not_ready" });
    await setFieldArchived(db, actor, {
      productCode: "career",
      partCode: "main",
      code: "general",
      archived: false,
    });
  });

  it("re-keys or deletes parts only with confirmation when real texts would go", async () => {
    await addPart(db, actor, {
      productCode: "career",
      code: "period",
      nameMn: "Төрсөн үе",
      keyType: "period",
    });
    await expect(
      addPart(db, actor, {
        productCode: "career",
        code: "pair",
        nameMn: "x",
        keyType: "sign_pair",
      }),
    ).rejects.toMatchObject({ code: "arity_mismatch" });
    // Empty part: key type may change freely.
    await updatePart(db, actor, {
      productCode: "career",
      code: "period",
      nameMn: "Үе",
      keyType: "month_day",
    });

    const text = (key: string, title = key) =>
      saveContentEntry(db, actor, {
        product: "career",
        section: "main",
        key,
        title,
        fields: { general: "Текст." },
        score: "",
        status: "published",
      });
    await text("leo|male");
    await text("leo|female", `${PLACEHOLDER_PREFIX} x`);
    expect(await partTextCounts(db, "career", "main")).toEqual({ real: 1, placeholder: 1 });

    const rekey = {
      productCode: "career",
      code: "main",
      nameMn: "Орд",
      keyType: "period" as const,
    };
    await expect(updatePart(db, actor, rekey)).rejects.toMatchObject({ code: "needs_confirm" });
    // Renaming alone never touches texts.
    await updatePart(db, actor, { ...rekey, keyType: "sign", byGender: true });
    expect((await partTextCounts(db, "career", "main")).real).toBe(1);

    await updatePart(db, actor, { ...rekey, confirm: true });
    expect(await partTextCounts(db, "career", "main")).toEqual({ real: 0, placeholder: 0 });

    // Placeholders alone never block.
    await saveContentEntry(db, actor, {
      product: "career",
      section: "period",
      key: "03-21",
      title: `${PLACEHOLDER_PREFIX} y`,
      fields: { general: "Текст." },
      score: "",
      status: "published",
    });
    await deletePart(db, actor, { productCode: "career", partCode: "period" });
    await expect(
      deletePart(db, actor, { productCode: "career", partCode: "main", confirm: true }),
    ).rejects.toMatchObject({ code: "last_part" });
    await updatePart(db, actor, { ...rekey, keyType: "sign", byGender: false });
  });

  it("switching the gender split on copies each text to both genders as drafts", async () => {
    await saveContentEntry(db, actor, {
      product: "career",
      section: "main",
      key: "leo",
      title: "Арслан",
      fields: { general: "Текст." },
      score: "",
      status: "published",
    });
    const on = {
      productCode: "career",
      code: "main",
      nameMn: "Орд",
      keyType: "sign" as const,
      byGender: true,
    };
    await expect(updatePart(db, actor, on)).rejects.toMatchObject({ code: "needs_confirm" });
    await updatePart(db, actor, { ...on, confirm: true });
    const rows = await db
      .select()
      .from(contentEntries)
      .where(eq(contentEntries.productCode, "career"));
    expect(rows.map((r) => [r.key, r.status, r.title]).sort()).toEqual([
      ["leo|female", "draft", "Арслан"],
      ["leo|male", "draft", "Арслан"],
    ]);
  });

  it("deletes a field only while no text uses it", async () => {
    const ref = { productCode: "career", partCode: "main" };
    await addField(db, actor, { ...ref, code: "unused", nameMn: "Хоосон", kind: "text" });
    expect(await fieldUsage(db, "career", "main")).toEqual({ general: 2 });
    await deleteField(db, actor, { ...ref, code: "unused" });
    await expect(deleteField(db, actor, { ...ref, code: "general" })).rejects.toMatchObject({
      code: "has_content",
    });
    const codes = (await loadProductDef(db, "career"))!.parts[0].fields.map((f) => f.code);
    expect(codes).not.toContain("unused");
  });

  it("rejects malformed codes on every catalog action", async () => {
    const bad = "x'; --";
    await expect(deleteProduct(db, actor, bad)).rejects.toBeInstanceOf(ZodError);
    await expect(
      deletePart(db, actor, { productCode: "career", partCode: bad }),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      deleteField(db, actor, { productCode: "career", partCode: "main", code: bad }),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      moveItem(db, actor, {
        productCode: "career",
        partCode: null,
        code: "main",
        dir: "sideways" as "up",
      }),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it("a bought product's parts are archived, never deleted or re-keyed", async () => {
    await addPart(db, actor, {
      productCode: "career",
      code: "extra",
      nameMn: "Нэмэлт",
      keyType: "period",
    });
    await db.insert(purchases).values({
      userId: actor,
      productCode: "career",
      pricePaid: 0,
      subjectKey: "career-subject",
      snapshot: { persons: [], keys: {} },
    });
    await expect(
      deletePart(db, actor, { productCode: "career", partCode: "extra", confirm: true }),
    ).rejects.toMatchObject({ code: "has_purchases" });
    await expect(
      updatePart(db, actor, {
        productCode: "career",
        code: "extra",
        nameMn: "x",
        keyType: "month_day",
        confirm: true,
      }),
    ).rejects.toMatchObject({ code: "has_purchases" });

    await setPartArchived(db, actor, { productCode: "career", partCode: "extra", archived: true });

    const def = (await loadProductDef(db, "career"))!;
    expect(def.parts.find((p) => p.code === "extra")?.archivedAt).not.toBeNull();
    // Archived parts leave coverage; the last active part can't be archived.
    expect((await contentCoverage(db)).filter((c) => c.product === "career")).toHaveLength(1);
    await expect(
      setPartArchived(db, actor, { productCode: "career", partCode: "main", archived: true }),
    ).rejects.toMatchObject({ code: "last_part" });
    await db.delete(purchases).where(eq(purchases.productCode, "career"));
  });

  it("deletes a product nobody bought, never one with purchases", async () => {
    await deleteProduct(db, actor, "career");
    expect(await loadProductDef(db, "career")).toBeNull();
    const left = await db
      .select()
      .from(contentEntries)
      .where(eq(contentEntries.productCode, "career"));
    expect(left).toHaveLength(0);

    await db.insert(purchases).values({
      userId: actor,
      productCode: "dating",
      pricePaid: 1000,
      subjectKey: "x",
      snapshot: { persons: [], keys: {} },
    });
    await expect(deleteProduct(db, actor, "dating")).rejects.toMatchObject({
      code: "has_purchases",
    });
  });
});

describe("sign pair → ordered sign pair", () => {
  it("is allowed after sales and keeps the texts (every key stays valid)", async () => {
    await createProduct(db, actor, {
      code: "pairs",
      nameMn: "Хос",
      personCount: 2,
      price: 0,
      keyType: "sign_pair",
    });
    await saveContentEntry(db, actor, {
      product: "pairs",
      section: "main",
      key: "aries|leo",
      title: "Хонь × Арслан",
      fields: { general: "Текст." },
      score: "",
      status: "published",
    });
    await db.insert(purchases).values({
      userId: actor,
      productCode: "pairs",
      pricePaid: 0,
      subjectKey: "pairs-subject",
      snapshot: { persons: [], keys: { main: "aries|leo" } },
    });
    const part = { productCode: "pairs", code: "main", nameMn: "Ордны нийцэл" };
    await expect(
      updatePart(db, actor, { ...part, keyType: "period_pair", confirm: true }),
    ).rejects.toMatchObject({ code: "has_purchases" });

    await updatePart(db, actor, { ...part, keyType: "sign_pair_ordered" });
    const def = (await loadProductDef(db, "pairs"))!;
    expect(def.parts[0].keyType).toBe("sign_pair_ordered");
    expect(await partTextCounts(db, "pairs", "main")).toEqual({ real: 1, placeholder: 0 });
    expect((await contentCoverage(db)).find((c) => c.product === "pairs")?.expected).toBe(144);
  });
});
