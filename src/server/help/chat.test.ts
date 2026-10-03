import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AiConfig, AiRequest } from "@/server/ai/providers";
import { appSettings, helpChats } from "@/server/db/schema";
import type { AppDb } from "@/server/db/types";
import { AVATAR_SEEDS } from "@/lib/avatars";
import { createSelf } from "@/server/persons";
import { createTestDb, insertUser } from "@/test/db";
import { chatQuestion, helpStats, listHelpChats } from "./admin";
import {
  HelpError,
  aiQuestionsToday,
  askHelp,
  describeUser,
  rateAnswer,
  recentConversation,
  type HelpDeps,
} from "./chat";
import { createFaq, deleteFaq, listFaqs, listPublishedFaqs, moveFaq, updateFaq } from "./faq";
import { CORE_KNOWLEDGE, groupsInWords, liveFacts, loadKnowledge } from "./knowledge";
import { createNote, deleteNote, listActiveNotes, updateNote } from "./notes";
import { DEFAULT_HELP_SETTINGS, getHelpSettings, saveHelpSettings } from "./settings";

let db: AppDb;
let close: () => Promise<void>;
let owner: string;
let alice: string;
let bob: string;

const CFG: AiConfig = { provider: "gemini", model: "gemini-test", apiKey: "k" };

function deps(over: Partial<HelpDeps> = {}) {
  const complete = vi.fn(async (_cfg: AiConfig, req: AiRequest) => ({
    text: `AI: ${req.user}`,
    usage: { input: 3000, cached: 2000, output: 80 },
  }));
  return {
    complete,
    deps: {
      config: async () => CFG,
      complete,
      appName: "Зурхай",
      host: "acyy.me",
      ...over,
    } satisfies HelpDeps,
  };
}

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  owner = (await insertUser(db, "owner@help.test")).id;
  alice = (await insertUser(db, "alice@help.test")).id;
  bob = (await insertUser(db, "bob@help.test")).id;
  await createSelf(db, alice, {
    name: "Алиса",
    birthDate: "1995-04-25",
    gender: "female",
    avatarSeed: AVATAR_SEEDS[0],
  });
});
afterAll(() => close());
beforeEach(async () => {
  await db.delete(helpChats);
  await db.delete(appSettings).where(eq(appSettings.key, "help"));
});

describe("FAQ", () => {
  it("starts with the top 10 from the migration, in order", async () => {
    const faqs = await listPublishedFaqs(db);
    expect(faqs).toHaveLength(10);
    expect(faqs[0].question).toBe("Зурхайг хэрхэн худалдаж авах вэ?");
    expect(faqs[2].question).toMatch(/үлдэгдэл нэмэгдээгүй/);
  });

  it("creates at the end, edits, hides, moves and deletes", async () => {
    const f = await createFaq(db, owner, { question: "Шинэ асуулт уу?", answer: "Тийм." });
    let all = await listFaqs(db);
    expect(all.at(-1)?.id).toBe(f.id);

    await updateFaq(db, owner, {
      id: f.id,
      question: "Шинэ асуулт?",
      answer: "Үгүй.",
      isPublished: false,
    });
    expect((await listPublishedFaqs(db)).some((x) => x.id === f.id)).toBe(false);

    await moveFaq(db, owner, f.id, "up");
    all = await listFaqs(db);
    expect(all.at(-2)?.id).toBe(f.id);
    await moveFaq(db, owner, all[0].id, "up"); // already first: nothing happens
    expect((await listFaqs(db))[0].id).toBe(all[0].id);

    await deleteFaq(db, owner, f.id);
    expect((await listFaqs(db)).some((x) => x.id === f.id)).toBe(false);
    await expect(deleteFaq(db, owner, f.id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("rejects empty or oversized text", async () => {
    await expect(createFaq(db, owner, { question: "", answer: "x" })).rejects.toThrow();
    await expect(
      createFaq(db, owner, { question: "Асуулт?", answer: "a".repeat(2001) }),
    ).rejects.toThrow();
  });
});

describe("knowledge", () => {
  it("writes who a product is for in relation names", () => {
    expect(groupsInWords(["self", "romantic"])).toBe("өөртөө, Хайрт, Краш");
    expect(groupsInWords(["self", "family", "romantic", "friend", "other"])).toBe("бүх хүнд");
  });

  it("takes prices and packages from the database", async () => {
    const facts = await liveFacts(db);
    expect(facts.body).toContain("Төрсөн өдрийн зурхай — 2,000₮, 1 хүн");
    expect(facts.body).toContain("Секс зурхай — 1,000₮, 1 хүн, 18+; өөртөө, Хайрт, Краш");
    expect(facts.body).toContain("10,000₮ → 11,000₮ (+1,000₮ бонус)");
  });

  it("orders core, facts, FAQs, then active admin notes (pinned)", async () => {
    const n = await createNote(db, owner, { title: "Хүргэлт", body: "Бид бараа хүргэдэггүй." });
    const off = await createNote(db, owner, { title: "Хуучин", body: "...", isActive: false });
    const chunks = await loadKnowledge(db);
    expect(chunks.slice(0, CORE_KNOWLEDGE.length)).toEqual(CORE_KNOWLEDGE);
    expect(chunks[CORE_KNOWLEDGE.length].id).toBe("facts");
    expect(chunks.filter((c) => c.id.startsWith("faq:"))).toHaveLength(10);
    const last = chunks.at(-1)!;
    expect(last).toMatchObject({ id: `note:${n.id}`, pinned: true });
    expect(chunks.some((c) => c.id === `note:${off.id}`)).toBe(false);

    await updateNote(db, owner, { id: n.id, title: "Хүргэлт", body: "Өөр.", isActive: false });
    expect(await listActiveNotes(db)).toEqual([]);
    await deleteNote(db, owner, n.id);
    await deleteNote(db, owner, off.id);
  });
});

describe("help settings", () => {
  it("defaults until saved, and validates the cost guards", async () => {
    expect(await getHelpSettings(db)).toEqual(DEFAULT_HELP_SETTINGS);
    await saveHelpSettings(db, owner, { ...DEFAULT_HELP_SETTINGS, dailyLimit: 5 });
    expect((await getHelpSettings(db)).dailyLimit).toBe(5);
    await expect(
      saveHelpSettings(db, owner, { ...DEFAULT_HELP_SETTINGS, maxAnswerTokens: 10 }),
    ).rejects.toThrow();
  });
});

describe("askHelp", () => {
  const conv = () => randomUUID();

  it("answers a near-FAQ question from the FAQ without calling the AI", async () => {
    const { deps: d, complete } = deps();
    const ex = await askHelp(
      db,
      alice,
      { conversationId: conv(), question: "Хэтэвчээ яаж цэнэглэх вэ?" },
      d,
    );
    expect(ex.source).toBe("faq");
    expect(ex.answer).toMatch(/QPay/);
    expect(complete).not.toHaveBeenCalled();
    expect(await aiQuestionsToday(db, alice)).toBe(0);
  });

  it("asks the AI with the rules, knowledge and the asker, and logs the usage", async () => {
    const { deps: d, complete } = deps();
    const ex = await askHelp(
      db,
      alice,
      { conversationId: conv(), question: "Нийцлийн зурхайд оноо яаж гардаг вэ?" },
      d,
    );
    expect(ex).toMatchObject({ source: "ai", answer: "AI: Нийцлийн зурхайд оноо яаж гардаг вэ?" });
    const req = complete.mock.calls[0][1];
    expect(req.system).toContain("тусламжийн туслах");
    expect(req.system).toContain("Нийцлийн зурхай");
    expect(req.system).toContain("Нэр: Алиса; орд: Үхэр");
    expect(req.history).toEqual([]);
    expect(req).toMatchObject({ maxTokens: 1200, effort: "low" });
    const [row] = await db.select().from(helpChats).where(eq(helpChats.id, ex.id));
    expect(row).toMatchObject({
      inputTokens: 3000,
      cachedTokens: 2000,
      outputTokens: 80,
      model: "gemini-test",
    });
  });

  it("sends earlier turns of the same conversation from the database, and no FAQ shortcut", async () => {
    const { deps: d, complete } = deps();
    const id = conv();
    await askHelp(db, alice, { conversationId: id, question: "Урилга хэр удаан хүчинтэй вэ?" }, d);
    await askHelp(db, alice, { conversationId: id, question: "Хэтэвчээ яаж цэнэглэх вэ?" }, d);
    const req = complete.mock.calls[1][1];
    expect(req.history).toEqual([
      { role: "user", text: "Урилга хэр удаан хүчинтэй вэ?" },
      { role: "assistant", text: "AI: Урилга хэр удаан хүчинтэй вэ?" },
    ]);
    // Bob can't continue Alice's conversation.
    await askHelp(db, bob, { conversationId: id, question: "Бусад хүмүүс юу асуусан бэ?" }, d);
    expect(complete.mock.calls[2][1].history).toEqual([]);
  });

  it("stops at the daily cap; admins aren't capped; FAQ answers don't count", async () => {
    await saveHelpSettings(db, owner, { ...DEFAULT_HELP_SETTINGS, dailyLimit: 2 });
    const { deps: d } = deps();
    await askHelp(db, bob, { conversationId: conv(), question: "Апп ямар хэлтэй вэ?" }, d);
    await askHelp(
      db,
      bob,
      { conversationId: conv(), question: "Апп-ыг утсанд суулгаж болох уу?" },
      d,
    );
    await expect(
      askHelp(db, bob, { conversationId: conv(), question: "Өнгө солих уу?" }, d),
    ).rejects.toMatchObject({ code: "limit" });
    await askHelp(db, bob, { conversationId: conv(), question: "Хэтэвчээ яаж цэнэглэх вэ?" }, d);
    await askHelp(
      db,
      bob,
      { conversationId: conv(), question: "Өнгө солих уу?" },
      { ...d, unlimited: true },
    );
  });

  it("refuses when switched off, without a key, or with a bad question", async () => {
    const { deps: d } = deps({
      config: async () => {
        throw new Error("no key");
      },
    });
    await expect(
      askHelp(db, alice, { conversationId: conv(), question: "Апп хэдэн хэлтэй вэ?" }, d),
    ).rejects.toMatchObject({ code: "not_configured" });
    await expect(
      askHelp(db, alice, { conversationId: "nope", question: "Сайн уу" }, d),
    ).rejects.toBeInstanceOf(HelpError);
    await expect(
      askHelp(db, alice, { conversationId: conv(), question: "x".repeat(501) }, d),
    ).rejects.toMatchObject({ code: "invalid" });
    await saveHelpSettings(db, owner, { ...DEFAULT_HELP_SETTINGS, enabled: false });
    await expect(
      askHelp(db, alice, { conversationId: conv(), question: "Хэтэвчээ яаж цэнэглэх вэ?" }, d),
    ).rejects.toMatchObject({ code: "disabled" });
  });

  it("lets only the asker rate an answer, and reopens a fresh conversation", async () => {
    const { deps: d } = deps();
    const id = conv();
    const ex = await askHelp(db, alice, { conversationId: id, question: "Апп ямар хэлтэй вэ?" }, d);
    await rateAnswer(db, bob, ex.id, -1);
    await rateAnswer(db, alice, ex.id, 1);
    const recent = await recentConversation(db, alice);
    expect(recent?.conversationId).toBe(id);
    expect(recent?.exchanges[0]).toMatchObject({ id: ex.id, feedback: 1 });
    expect(
      await recentConversation(db, alice, { now: new Date(Date.now() + 7 * 3600_000) }),
    ).toBeNull();
  });

  it("feeds the admin stats and history", async () => {
    const { deps: d } = deps();
    const ai = await askHelp(
      db,
      alice,
      { conversationId: conv(), question: "Апп ямар хэлтэй вэ?" },
      d,
    );
    await askHelp(db, alice, { conversationId: conv(), question: "Хэтэвчээ яаж цэнэглэх вэ?" }, d);
    await rateAnswer(db, alice, ai.id, -1);
    const stats = await helpStats(db, new Date(Date.now() - 3600_000));
    expect(stats).toMatchObject({
      questions: 2,
      ai: 1,
      faq: 1,
      users: 1,
      inputTokens: 3000,
      down: 1,
    });
    expect((await listHelpChats(db, "down")).map((r) => r.id)).toEqual([ai.id]);
    expect((await listHelpChats(db, "faq"))[0].email).toBe("alice@help.test");
    expect(await chatQuestion(db, ai.id)).toBe("Апп ямар хэлтэй вэ?");
    expect(await chatQuestion(db, "../etc")).toBe("");
  });
});

describe("describeUser", () => {
  it("is a short line without the user's email", async () => {
    const line = await describeUser(db, alice);
    expect(line).toContain("хэтэвчний үлдэгдэл: 0₮");
    expect(line).toContain("18+ баталгаажуулсан: үгүй");
    expect(line).not.toContain("@");
  });
});
