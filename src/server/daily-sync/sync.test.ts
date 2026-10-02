import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AiError } from "@/server/ai/providers";
import { auditLogs, dailyEntries, dailyKinds } from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";
import { createTestDb, insertUser } from "@/test/db";
import { SOURCE_PATHS } from "./astrology";
import { SyncError, lastDailySync, runDailySync, runDailySyncOnce, type SyncOptions } from "./sync";

let db: AppDb;
let close: () => Promise<void>;
let actor: string;

// 2026-10-02 20:00 in Mongolia → astrology.com's "tomorrow" is 2026-10-03.
const NOW = new Date("2026-10-02T12:00:00Z");
const TOMORROW = "2026-10-03";

const KIND_OF_PATH = Object.fromEntries(Object.entries(SOURCE_PATHS).map(([k, p]) => [p, k]));

/** Fake astrology.com: `/horoscope/<path>/tomorrow/<sign>.html` → a page with English text. */
function fakeSite(overrides: { date?: string; fail?: string[] } = {}) {
  return vi.fn(async (url: string) => {
    const m = /horoscope\/([a-z-]+)\/tomorrow\/([a-z]+)\.html$/.exec(url)!;
    const [, path, sign] = m;
    const kind = KIND_OF_PATH[path];
    if (overrides.fail?.includes(`${kind}:${sign}`)) throw new Error("boom");
    return `<div id="content"><p>EN ${kind} ${sign}</p></div>
      <script>init({ zodiacSign: "${sign}", horoscopeDate: "${overrides.date ?? TOMORROW}" })</script>`;
  });
}

/** Fake AI: answers {sign: "MN <kind> <sign>"} for every sign in the request. */
function fakeAi(opts: { failKind?: string; dropSign?: string } = {}) {
  return vi.fn(async (req: { user: string; system: string }) => {
    const texts = JSON.parse(req.user.slice(req.user.indexOf("{"))) as Record<string, string>;
    const out: Record<string, string> = {};
    for (const [sign, en] of Object.entries(texts)) {
      const kind = en.split(" ")[1];
      if (kind === opts.failKind) throw new AiError("http", "401: bad key", 401);
      if (sign !== opts.dropSign) out[sign] = `MN ${kind} ${sign}`;
    }
    return JSON.stringify(out);
  });
}

function options(over: Partial<SyncOptions> & { complete?: ReturnType<typeof fakeAi> } = {}) {
  const { complete, ...rest } = over;
  return {
    actorId: actor,
    trigger: "manual" as const,
    ai: { provider: "gemini" as const, model: "m", prompt: "P", complete: complete ?? fakeAi() },
    fetchPage: fakeSite(),
    now: NOW,
    ...rest,
  };
}

const text = async (kind: string, sign: string, date = TOMORROW) =>
  (
    await db
      .select({ text: dailyEntries.text, by: dailyEntries.updatedBy })
      .from(dailyEntries)
      .where(
        and(
          eq(dailyEntries.kindCode, kind),
          eq(dailyEntries.signCode, sign),
          eq(dailyEntries.date, date),
        ),
      )
  )[0];

let KINDS: (typeof dailyKinds.$inferInsert)[];

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

describe("daily sync", () => {
  it("fetches 3 kinds × 12 signs, translates per kind and saves them for tomorrow", async () => {
    const complete = fakeAi();
    const fetchPage = fakeSite();
    const report = await runDailySync(db, options({ complete, fetchPage }));

    expect(fetchPage).toHaveBeenCalledTimes(36);
    expect(complete).toHaveBeenCalledTimes(3);
    expect(report).toMatchObject({ dates: [TOMORROW], saved: 36, total: 36, issues: [] });
    expect(report.byKind.map((k) => [k.kind, k.saved])).toEqual([
      ["general", 12],
      ["love", 12],
      ["work", 12],
    ]);
    expect(await text("love", "pisces")).toEqual({ text: "MN love pisces", by: actor });

    // The request carries the admin prompt and our sign names.
    const req = complete.mock.calls[0][0];
    expect(req.system.startsWith("P")).toBe(true);
    expect(req.system).toContain("Aries — Хонь");

    const last = await lastDailySync(db);
    expect(last?.report).toMatchObject({ saved: 36, trigger: "manual", dates: [TOMORROW] });
  });

  it("overwrites texts already written for that day", async () => {
    await db
      .insert(dailyEntries)
      .values({ kindCode: "general", date: TOMORROW, signCode: "aries", text: "Гараар" });
    await runDailySync(db, options({ actorId: null, trigger: "cron" }));
    expect(await text("general", "aries")).toEqual({ text: "MN general aries", by: null });
  });

  it("skips what failed and saves the rest", async () => {
    const report = await runDailySync(
      db,
      options({
        fetchPage: fakeSite({ fail: ["general:leo"] }),
        complete: fakeAi({ failKind: "work", dropSign: "virgo" }),
      }),
    );
    // general: 10 (leo not fetched, virgo not translated), love: 11, work: 0 (AI error).
    expect(report.saved).toBe(21);
    expect(report.issues).toEqual([
      { kind: "general", sign: "leo", code: "fetch" },
      { kind: "general", sign: "virgo", code: "missing" },
      { kind: "love", sign: "virgo", code: "missing" },
      { kind: "work", code: "ai", detail: "401: bad key" },
    ]);
    expect(await text("general", "leo")).toBeUndefined();
    expect(await text("love", "aries")).toBeDefined();
    expect(await text("work", "aries")).toBeUndefined();
  });

  it("retries a flaky answer once, but not an auth error", async () => {
    let calls = 0;
    const ok = fakeAi();
    const flaky = vi.fn(async (req: Parameters<typeof ok>[0]) =>
      ++calls === 1 ? "garbage" : ok(req),
    );
    const report = await runDailySync(db, options({ complete: flaky as never }));
    expect(report.saved).toBe(36);
    expect(flaky).toHaveBeenCalledTimes(4);

    const auth = fakeAi({ failKind: "general" });
    await runDailySync(db, options({ complete: auth }));
    // general: 1 call (no retry), love + work: 1 each.
    expect(auth).toHaveBeenCalledTimes(3);
  });

  it("never writes a page whose date is not around today", async () => {
    const report = await runDailySync(db, options({ fetchPage: fakeSite({ date: "2025-01-01" }) }));
    expect(report.saved).toBe(0);
    expect(report.issues).toHaveLength(36);
    expect(report.issues[0]).toMatchObject({ code: "stale_date", detail: "2025-01-01" });
    // Still logged, so admins see the failed run.
    expect((await lastDailySync(db))?.report.saved).toBe(0);
  });

  it("handles the year end", async () => {
    const report = await runDailySync(
      db,
      options({
        now: new Date("2026-12-31T12:00:00Z"),
        fetchPage: fakeSite({ date: "2027-01-01" }),
      }),
    );
    expect(report.dates).toEqual(["2027-01-01"]);
  });

  it("only syncs the kinds astrology.com has, and needs at least one", async () => {
    await db.insert(dailyKinds).values({ code: "money", nameMn: "Мөнгө" });
    const report = await runDailySync(db, options());
    expect(report.byKind.map((k) => k.kind)).toEqual(["general", "love", "work"]);

    await db.delete(dailyKinds);
    await db.insert(dailyKinds).values({ code: "money", nameMn: "Мөнгө" });
    await expect(runDailySync(db, options())).rejects.toEqual(new SyncError("no_kinds"));
  });

  it("runs one sync at a time", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const ok = fakeAi();
    const slow = vi.fn(async (req: Parameters<typeof ok>[0]) => {
      await gate;
      return ok(req);
    });
    const first = runDailySyncOnce(db, options({ complete: slow as never }));
    await expect(runDailySyncOnce(db, options())).rejects.toEqual(new SyncError("busy"));
    release();
    await expect(first).resolves.toMatchObject({ saved: 36 });
    await expect(runDailySyncOnce(db, options())).resolves.toMatchObject({ saved: 36 });
  });
});
