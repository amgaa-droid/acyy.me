import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";

import { PRODUCT_ICONS, PRODUCT_TINTS } from "@/lib/domain";
import { addDays, isoDateSchema } from "@/lib/daily";
import { logAudit } from "@/server/audit";
import { dailyEntries, dailyKinds, zodiacSigns } from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";

/**
 * Daily horoscopes: one text per kind × sign × day, free to read (no paywall — they are not
 * products). Home's "today" view shows the account owner's sign; admins write them on
 * /admin/daily (texts: Editor/Owner, kinds: Owner).
 */

export type DailyKind = typeof dailyKinds.$inferSelect;

/** One card on the "today" view; `text` null = not written for this day yet. */
export type DailyReading = {
  code: string;
  name: string;
  icon: string;
  tint: string;
  text: string | null;
};

export const DAILY_TEXT_MAX = 3000;

export class DailyError extends Error {
  constructor(readonly code: "unknown_kind" | "unknown_sign" | "duplicate_code" | "last_active") {
    super(code);
  }
}

export async function listDailyKinds(
  db: AppDb,
  opts: { activeOnly?: boolean } = {},
): Promise<DailyKind[]> {
  return db
    .select()
    .from(dailyKinds)
    .where(opts.activeOnly ? eq(dailyKinds.isActive, true) : undefined)
    .orderBy(asc(dailyKinds.sort), asc(dailyKinds.code));
}

/** The active kinds' texts for one sign on one day, in kind order. */
export async function dailyForSign(
  db: AppDb,
  signCode: string,
  date: string,
): Promise<DailyReading[]> {
  const [kinds, rows] = await Promise.all([
    listDailyKinds(db, { activeOnly: true }),
    db
      .select({ kindCode: dailyEntries.kindCode, text: dailyEntries.text })
      .from(dailyEntries)
      .where(and(eq(dailyEntries.signCode, signCode), eq(dailyEntries.date, date))),
  ]);
  const byKind = new Map(rows.map((r) => [r.kindCode, r.text]));
  return kinds.map((k) => ({
    code: k.code,
    name: k.nameMn,
    icon: k.icon,
    tint: k.tint,
    text: byKind.get(k.code) ?? null,
  }));
}

/** Every text of one day: kind code → sign code → text (admin editor). */
export async function dailyDay(
  db: AppDb,
  date: string,
): Promise<Record<string, Record<string, string>>> {
  const rows = await db
    .select({
      kindCode: dailyEntries.kindCode,
      signCode: dailyEntries.signCode,
      text: dailyEntries.text,
    })
    .from(dailyEntries)
    .where(eq(dailyEntries.date, date));
  const out: Record<string, Record<string, string>> = {};
  for (const r of rows) (out[r.kindCode] ??= {})[r.signCode] = r.text;
  return out;
}

/**
 * How many texts each day from `from` has, out of active kinds × 12 signs — so admins see
 * which days still need writing.
 */
export async function dailyCoverage(
  db: AppDb,
  from: string,
  days: number,
): Promise<{ date: string; filled: number; total: number }[]> {
  const to = addDays(from, days - 1);
  const [kinds, [{ signs }], rows] = await Promise.all([
    listDailyKinds(db, { activeOnly: true }),
    db.select({ signs: sql<number>`count(*)::int` }).from(zodiacSigns),
    db
      .select({
        date: dailyEntries.date,
        kindCode: dailyEntries.kindCode,
        n: sql<number>`count(*)::int`,
      })
      .from(dailyEntries)
      .where(and(gte(dailyEntries.date, from), lte(dailyEntries.date, to)))
      .groupBy(dailyEntries.date, dailyEntries.kindCode),
  ]);
  const active = new Set(kinds.map((k) => k.code));
  const filled = new Map<string, number>();
  for (const r of rows) {
    if (active.has(r.kindCode)) filled.set(r.date, (filled.get(r.date) ?? 0) + r.n);
  }
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i);
    return { date, filled: filled.get(date) ?? 0, total: kinds.length * signs };
  });
}

export const saveDailyTextsSchema = z.object({
  date: isoDateSchema,
  kind: z.string().min(1).max(32),
  /** Sign code → text. An empty text deletes that sign's text for the day. */
  texts: z.record(z.string().min(1).max(32), z.string().max(DAILY_TEXT_MAX)),
});

/** Saves one kind's texts for one day (a subset of signs is fine); returns what changed. */
export async function saveDailyTexts(
  db: AppDb,
  actorId: string,
  input: z.input<typeof saveDailyTextsSchema>,
): Promise<{ saved: number; cleared: number }> {
  const { date, kind, texts } = saveDailyTextsSchema.parse(input);
  return db.transaction(async (tx) => {
    const [k] = await tx
      .select({ code: dailyKinds.code })
      .from(dailyKinds)
      .where(eq(dailyKinds.code, kind));
    if (!k) throw new DailyError("unknown_kind");
    const codes = Object.keys(texts);
    const known = codes.length
      ? await tx
          .select({ code: zodiacSigns.code })
          .from(zodiacSigns)
          .where(inArray(zodiacSigns.code, codes))
      : [];
    if (known.length !== codes.length) throw new DailyError("unknown_sign");

    const put = codes
      .map((signCode) => ({ signCode, text: texts[signCode].replace(/\r\n/g, "\n").trim() }))
      .filter((r) => r.text);
    const clear = codes.filter((c) => !texts[c].trim());
    if (put.length) {
      await tx
        .insert(dailyEntries)
        .values(
          put.map((r) => ({
            kindCode: kind,
            date,
            signCode: r.signCode,
            text: r.text,
            updatedBy: actorId,
          })),
        )
        .onConflictDoUpdate({
          target: [dailyEntries.kindCode, dailyEntries.date, dailyEntries.signCode],
          set: { text: sql.raw("excluded.text"), updatedBy: actorId, updatedAt: new Date() },
        });
    }
    if (clear.length) {
      await tx
        .delete(dailyEntries)
        .where(
          and(
            eq(dailyEntries.kindCode, kind),
            eq(dailyEntries.date, date),
            inArray(dailyEntries.signCode, clear),
          ),
        );
    }
    await logAudit(tx, {
      actorId,
      action: "daily.save",
      entity: "daily_entries",
      entityId: `${kind}:${date}`,
      data: { saved: put.map((r) => r.signCode), cleared: clear },
    });
    return { saved: put.length, cleared: clear.length };
  });
}

const kindFields = {
  nameMn: z.string().trim().min(1).max(60),
  icon: z.enum(PRODUCT_ICONS),
  tint: z.enum(PRODUCT_TINTS),
  sort: z.number().int().min(0).max(9999),
};

export const createDailyKindSchema = z.object({
  code: z.string().regex(/^[a-z][a-z0-9_]{1,31}$/),
  ...kindFields,
});

export const updateDailyKindSchema = z.object({
  code: z.string().min(1).max(32),
  ...kindFields,
  isActive: z.boolean(),
});

export async function createDailyKind(
  db: AppDb,
  actorId: string,
  input: z.input<typeof createDailyKindSchema>,
): Promise<DailyKind> {
  const data = createDailyKindSchema.parse(input);
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(dailyKinds).values(data).onConflictDoNothing().returning();
    if (!row) throw new DailyError("duplicate_code");
    await logAudit(tx, {
      actorId,
      action: "daily_kind.create",
      entity: "daily_kinds",
      entityId: row.code,
      data,
    });
    return row;
  });
}

/** Renames, re-orders, re-styles or (de)activates a kind. The code never changes. */
export async function updateDailyKind(
  db: AppDb,
  actorId: string,
  input: z.input<typeof updateDailyKindSchema>,
): Promise<DailyKind> {
  const { code, ...data } = updateDailyKindSchema.parse(input);
  return db.transaction(async (tx) => {
    if (!data.isActive) {
      const others = await tx
        .select({ code: dailyKinds.code })
        .from(dailyKinds)
        .where(eq(dailyKinds.isActive, true));
      if (!others.some((o) => o.code !== code)) throw new DailyError("last_active");
    }
    const [row] = await tx
      .update(dailyKinds)
      .set(data)
      .where(eq(dailyKinds.code, code))
      .returning();
    if (!row) throw new DailyError("unknown_kind");
    await logAudit(tx, {
      actorId,
      action: "daily_kind.update",
      entity: "daily_kinds",
      entityId: code,
      data,
    });
    return row;
  });
}
