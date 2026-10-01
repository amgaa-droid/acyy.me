import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { LANDING_DEFAULTS, type LandingContent } from "@/lib/landing-content";
import { auditLogs, contentEntries, pageDrafts, pageVersions } from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";
import { createTestDb, insertUser } from "@/test/db";
import {
  DraftConflictError,
  NothingToPublishError,
  VersionNotFoundError,
  discardLandingDraft,
  getLandingDraft,
  getPublishedLanding,
  listLandingVersions,
  publishLandingDraft,
  relationSuggestions,
  restoreIntoDraft,
  saveLandingDraft,
} from "./landing-cms";

let db: AppDb;
let close: () => Promise<void>;
let actor: string;

const withTitle = (title: string): LandingContent => ({
  ...structuredClone(LANDING_DEFAULTS),
  hero: { ...LANDING_DEFAULTS.hero, title },
});

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  actor = (await insertUser(db, "editor@test.local")).id;
});
afterAll(() => close());
beforeEach(async () => {
  await db.delete(pageDrafts);
  await db.delete(pageVersions);
  await db.delete(auditLogs);
});

describe("landing CMS", () => {
  it("serves the defaults until something is published", async () => {
    const live = await getPublishedLanding(db);
    expect(live.version).toBeNull();
    expect(live.content).toEqual(LANDING_DEFAULTS);
  });

  it("a saved draft doesn't change the live page", async () => {
    await saveLandingDraft(db, actor, withTitle("Ноорог"), 0);
    expect((await getPublishedLanding(db)).content.hero.title).toBe(LANDING_DEFAULTS.hero.title);
    const draft = await getLandingDraft(db);
    expect(draft?.content.hero.title).toBe("Ноорог");
    expect(draft?.revision).toBe(1);
    expect(draft?.updatedBy).toBe("editor@test.local");
  });

  it("rejects invalid content", async () => {
    await expect(saveLandingDraft(db, actor, withTitle(""), 0)).rejects.toBeInstanceOf(ZodError);
    expect(await getLandingDraft(db)).toBeNull();
  });

  it("detects a concurrent save (stale revision)", async () => {
    const a = await saveLandingDraft(db, actor, withTitle("A"), 0);
    await saveLandingDraft(db, actor, withTitle("B"), a.revision);
    // Second admin still on revision 1:
    await expect(saveLandingDraft(db, actor, withTitle("C"), a.revision)).rejects.toBeInstanceOf(
      DraftConflictError,
    );
    // And "no draft yet" when one exists:
    await expect(saveLandingDraft(db, actor, withTitle("D"), 0)).rejects.toBeInstanceOf(
      DraftConflictError,
    );
    expect((await getLandingDraft(db))?.content.hero.title).toBe("B");
  });

  it("publishes as increasing versions, clears the draft and writes an audit row", async () => {
    let r = await saveLandingDraft(db, actor, withTitle("v1"), 0);
    expect(await publishLandingDraft(db, actor, r.revision, "эхний")).toEqual({ version: 1 });
    expect(await getLandingDraft(db)).toBeNull();

    r = await saveLandingDraft(db, actor, withTitle("v2"), 0);
    expect(await publishLandingDraft(db, actor, r.revision, null)).toEqual({ version: 2 });

    const live = await getPublishedLanding(db);
    expect(live.version).toBe(2);
    expect(live.content.hero.title).toBe("v2");

    const versions = await listLandingVersions(db);
    expect(versions.map((v) => [v.version, v.note, v.publishedBy])).toEqual([
      [2, null, "editor@test.local"],
      [1, "эхний", "editor@test.local"],
    ]);
    const audit = await db.select().from(auditLogs).where(eq(auditLogs.action, "page.publish"));
    expect(audit).toHaveLength(2);
  });

  it("won't publish a stale or missing draft", async () => {
    await expect(publishLandingDraft(db, actor, 1, null)).rejects.toBeInstanceOf(
      NothingToPublishError,
    );
    const r = await saveLandingDraft(db, actor, withTitle("x"), 0);
    await saveLandingDraft(db, actor, withTitle("y"), r.revision);
    await expect(publishLandingDraft(db, actor, r.revision, null)).rejects.toBeInstanceOf(
      DraftConflictError,
    );
    expect((await getPublishedLanding(db)).version).toBeNull();
  });

  it("restores an old version into the draft — the live page stays until published", async () => {
    let r = await saveLandingDraft(db, actor, withTitle("first"), 0);
    await publishLandingDraft(db, actor, r.revision, null);
    r = await saveLandingDraft(db, actor, withTitle("second"), 0);
    await publishLandingDraft(db, actor, r.revision, null);

    const [, v1] = await listLandingVersions(db);
    r = await restoreIntoDraft(db, actor, v1.id, 0);
    expect((await getLandingDraft(db))?.content.hero.title).toBe("first");
    expect((await getPublishedLanding(db)).content.hero.title).toBe("second");

    await publishLandingDraft(db, actor, r.revision, null);
    const live = await getPublishedLanding(db);
    expect([live.version, live.content.hero.title]).toEqual([3, "first"]);
  });

  it("restores the built-in defaults, and rejects unknown versions", async () => {
    const r = await saveLandingDraft(db, actor, withTitle("changed"), 0);
    await restoreIntoDraft(db, actor, null, r.revision);
    expect((await getLandingDraft(db))?.content).toEqual(LANDING_DEFAULTS);
    await expect(
      restoreIntoDraft(db, actor, "00000000-0000-4000-8000-000000000000", 2),
    ).rejects.toBeInstanceOf(VersionNotFoundError);
  });

  it("discards the draft", async () => {
    await saveLandingDraft(db, actor, withTitle("gone"), 0);
    await discardLandingDraft(db, actor);
    expect(await getLandingDraft(db)).toBeNull();
  });
});

describe("relationSuggestions", () => {
  it("splits and counts relation chips from synastry texts, most common first", async () => {
    await db.insert(contentEntries).values([
      {
        productCode: "synastry",
        section: "period_pair",
        key: "1|2",
        title: "a",
        fields: { good_for: "Гэрлэлт, Ах дүү", caution_for: "Ажил" },
      },
      {
        productCode: "synastry",
        section: "period_pair",
        key: "1|3",
        title: "b",
        fields: { good_for: "Гэрлэлт\nНөхөрлөл", caution_for: "" },
      },
    ]);
    const chips = await relationSuggestions(db);
    expect(chips[0]).toBe("Гэрлэлт");
    expect([...chips].sort()).toEqual(["Ажил", "Ах дүү", "Гэрлэлт", "Нөхөрлөл"].sort());
  });
});
