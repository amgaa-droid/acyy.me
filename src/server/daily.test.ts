import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { auditLogs, dailyEntries, dailyKinds } from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";
import { createTestDb, insertUser } from "@/test/db";
import {
  DailyError,
  createDailyKind,
  dailyCoverage,
  dailyDay,
  dailyForSign,
  listDailyKinds,
  saveDailyTexts,
  updateDailyKind,
} from "./daily";

let db: AppDb;
let KINDS: (typeof dailyKinds.$inferInsert)[];
let close: () => Promise<void>;
let actor: string;

const DAY = "2026-10-02";

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  actor = (await insertUser(db, "editor@test.local")).id;
  KINDS = await db.select().from(dailyKinds);
});
afterAll(() => close());
beforeEach(async () => {
  await db.delete(dailyEntries);
  await db.delete(auditLogs);
  await db.delete(dailyKinds);
  await db.insert(dailyKinds).values(KINDS);
});

describe("daily kinds", () => {
  it("starts with the three kinds from the migration, in order", async () => {
    const kinds = await listDailyKinds(db);
    expect(kinds.map((k) => [k.code, k.nameMn])).toEqual([
      ["general", "Өнөөдрийн зурхай"],
      ["love", "Өнөөдрийн хайрын зурхай"],
      ["work", "Өнөөдрийн ажлын зурхай"],
    ]);
  });

  it("creates a kind once and rejects a bad or taken code", async () => {
    const k = await createDailyKind(db, actor, {
      code: "money",
      nameMn: "Мөнгө",
      icon: "gem",
      tint: "tint-3",
      sort: 4,
    });
    expect(k.isActive).toBe(true);
    await expect(
      createDailyKind(db, actor, {
        code: "money",
        nameMn: "x",
        icon: "gem",
        tint: "tint-3",
        sort: 5,
      }),
    ).rejects.toEqual(new DailyError("duplicate_code"));
    await expect(
      createDailyKind(db, actor, {
        code: "Bad Code",
        nameMn: "x",
        icon: "gem",
        tint: "tint-3",
        sort: 5,
      }),
    ).rejects.toBeInstanceOf(ZodError);
    const [log] = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "daily_kind.create"));
    expect(log.entityId).toBe("money");
  });

  it("deactivates a kind but never the last active one", async () => {
    const base = { nameMn: "x", icon: "sun", tint: "tint-2", sort: 1 } as const;
    await updateDailyKind(db, actor, { ...base, code: "love", isActive: false });
    await updateDailyKind(db, actor, { ...base, code: "work", isActive: false });
    await expect(
      updateDailyKind(db, actor, { ...base, code: "general", isActive: false }),
    ).rejects.toEqual(new DailyError("last_active"));
    expect((await listDailyKinds(db, { activeOnly: true })).map((k) => k.code)).toEqual([
      "general",
    ]);
    await expect(
      updateDailyKind(db, actor, { ...base, code: "nope", isActive: true }),
    ).rejects.toEqual(new DailyError("unknown_kind"));
  });
});

describe("daily texts", () => {
  it("saves, updates and clears one kind's texts for a day", async () => {
    await saveDailyTexts(db, actor, {
      date: DAY,
      kind: "general",
      texts: { aries: " Сайхан өдөр. ", leo: "Анхаар." },
    });
    expect(await dailyDay(db, DAY)).toEqual({ general: { aries: "Сайхан өдөр.", leo: "Анхаар." } });

    const res = await saveDailyTexts(db, actor, {
      date: DAY,
      kind: "general",
      texts: { aries: "Шинэ.", leo: "  " },
    });
    expect(res).toEqual({ saved: 1, cleared: 1 });
    expect(await dailyDay(db, DAY)).toEqual({ general: { aries: "Шинэ." } });
    expect(
      await db.select().from(auditLogs).where(eq(auditLogs.action, "daily.save")),
    ).toHaveLength(2);
  });

  it("rejects an unknown kind, an unknown sign or a bad date", async () => {
    await expect(saveDailyTexts(db, actor, { date: DAY, kind: "nope", texts: {} })).rejects.toEqual(
      new DailyError("unknown_kind"),
    );
    await expect(
      saveDailyTexts(db, actor, { date: DAY, kind: "love", texts: { pluto: "x" } }),
    ).rejects.toEqual(new DailyError("unknown_sign"));
    await expect(
      saveDailyTexts(db, actor, { date: "2026-02-30", kind: "love", texts: {} }),
    ).rejects.toBeInstanceOf(ZodError);
    expect(await dailyDay(db, DAY)).toEqual({});
  });

  it("shows a sign its active kinds for that day only, unwritten ones as null", async () => {
    await saveDailyTexts(db, actor, {
      date: DAY,
      kind: "general",
      texts: { scorpio: "Өнөөдөр", aries: "Бусдынх" },
    });
    await saveDailyTexts(db, actor, {
      date: "2026-10-03",
      kind: "love",
      texts: { scorpio: "Маргааш" },
    });
    await saveDailyTexts(db, actor, { date: DAY, kind: "work", texts: { scorpio: "Ажил" } });
    await updateDailyKind(db, actor, {
      code: "work",
      nameMn: "Ажил",
      icon: "briefcase",
      tint: "tint-1",
      sort: 3,
      isActive: false,
    });

    expect(await dailyForSign(db, "scorpio", DAY)).toEqual([
      { code: "general", name: "Өнөөдрийн зурхай", icon: "sun", tint: "tint-2", text: "Өнөөдөр" },
      { code: "love", name: "Өнөөдрийн хайрын зурхай", icon: "heart", tint: "tint-3", text: null },
    ]);
  });

  it("counts each day's texts of active kinds out of kinds × 12 signs", async () => {
    await saveDailyTexts(db, actor, {
      date: DAY,
      kind: "general",
      texts: { aries: "a", leo: "b" },
    });
    await saveDailyTexts(db, actor, { date: DAY, kind: "love", texts: { aries: "c" } });
    await saveDailyTexts(db, actor, { date: "2027-01-01", kind: "work", texts: { aries: "d" } });

    const cov = await dailyCoverage(db, "2026-12-31", 2);
    expect(cov).toEqual([
      { date: "2026-12-31", filled: 0, total: 36 },
      { date: "2027-01-01", filled: 1, total: 36 },
    ]);
    expect((await dailyCoverage(db, DAY, 1))[0]).toEqual({ date: DAY, filled: 3, total: 36 });
  });
});
