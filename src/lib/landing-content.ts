import { z } from "zod";

import { mn } from "@/i18n/mn";
import { AVATAR_SEEDS, avatarFits, avatarGender } from "@/lib/avatar-seeds";
import { parseIsoDate } from "@/lib/birth-date";

/**
 * The signed-out landing page's editable content (admin CMS, /admin/landing).
 * One JSON document per published version; every section has its own schema so a section that
 * no longer validates (e.g. after a schema change) falls back to its default without taking the
 * rest of the page with it. Defaults are the copy in src/i18n/mn.ts.
 *
 * Text may contain price tokens filled in from the live catalogue at render time:
 * {minPrice}, {birthdayPrice}, {synastryPrice}.
 */

export const LIMITS = { short: 40, title: 120, text: 400, long: 1200 } as const;

const str = (max: number) => z.string().trim().min(1).max(max);
const optStr = (max: number) => z.string().trim().max(max);
const strList = (max: number, maxItems: number) => z.array(str(max)).max(maxItems);

export const DEMO_TINTS = ["bg-tint-1", "bg-tint-2", "bg-tint-3"] as const;
export const MAX_DEMO_PEOPLE = 5;

const birthDate = z
  .string()
  .refine((v) => parseIsoDate(v) !== null && v >= "1900-01-01", { message: "invalid_date" });

export const AVATAR_GENDERS = ["female", "male"] as const;

/** An example avatar: gender + seed index; the drawing must suit the gender. */
const avatar = {
  gender: z.enum(AVATAR_GENDERS),
  seed: z
    .number()
    .int()
    .min(0)
    .max(AVATAR_SEEDS.length - 1),
};
const fitsGender = (v: { gender: (typeof AVATAR_GENDERS)[number]; seed: number }) =>
  avatarFits(v.seed, v.gender);
const AVATAR_GENDER_MSG = { message: "avatar_gender", path: ["seed"] };

const demoPerson = z
  .object({
    id: z.string().min(1).max(40),
    name: str(LIMITS.short),
    birthDate,
    ...avatar,
    tint: z.enum(DEMO_TINTS),
  })
  .refine(fitsGender, AVATAR_GENDER_MSG);

const labelledAvatar = z
  .object({ label: str(LIMITS.short), ...avatar })
  .refine(fitsGender, AVATAR_GENDER_MSG);

/** One side of the synastry example: shown like a real pair reading (sign and period from the date). */
const pairPerson = z
  .object({ label: str(LIMITS.short), birthDate: birthDate.optional(), ...avatar })
  .refine(fitsGender, AVATAR_GENDER_MSG);

const demoLink = z.object({
  id: z.string().min(1).max(40),
  a: z.string().min(1),
  b: z.string().min(1),
  goodFor: strList(LIMITS.short, 6),
  cautionFor: strList(LIMITS.short, 6),
  text: optStr(LIMITS.text),
});

export const SECTION_SCHEMAS = {
  seo: z.object({ title: str(LIMITS.title), description: str(300) }),
  hero: z.object({
    eyebrow: optStr(LIMITS.short * 2),
    title: str(LIMITS.title),
    subtitle: optStr(LIMITS.text),
    pickBirthday: str(LIMITS.short),
    hint: optStr(LIMITS.title),
  }),
  demo: z
    .object({
      people: z.array(demoPerson).min(1).max(MAX_DEMO_PEOPLE),
      links: z.array(demoLink).max(8),
      goodLabel: str(LIMITS.short),
      cautionLabel: str(LIMITS.short),
      example: str(LIMITS.short),
      cta: str(LIMITS.short),
    })
    .superRefine((d, ctx) => {
      const ids = new Set(d.people.map((p) => p.id));
      if (ids.size !== d.people.length)
        ctx.addIssue({ code: "custom", path: ["people"], message: "duplicate_id" });
      d.links.forEach((l, i) => {
        if (!ids.has(l.a) || !ids.has(l.b) || l.a === l.b)
          ctx.addIssue({ code: "custom", path: ["links", i, "b"], message: "bad_pair" });
      });
    }),
  daily: z.object({
    eyebrow: optStr(LIMITS.short * 2),
    title: str(LIMITS.title),
    body: optStr(LIMITS.text),
    pickSign: str(LIMITS.short * 2),
    empty: str(LIMITS.title),
    more: str(LIMITS.short * 2),
    cta: str(LIMITS.short * 2),
    note: optStr(LIMITS.title),
  }),
  stats: z.object({
    items: z.array(z.object({ value: str(LIMITS.short), label: str(LIMITS.title) })).max(4),
  }),
  products: z.object({
    title: str(LIMITS.title),
    subtitle: optStr(LIMITS.text),
    open: str(LIMITS.short),
    items: z
      .array(
        z.object({
          code: z.string().min(1).max(40),
          hook: optStr(LIMITS.text),
          badge: optStr(LIMITS.short),
        }),
      )
      .max(30),
  }),
  synastry: z.object({
    eyebrow: optStr(LIMITS.short * 2),
    title: str(LIMITS.title),
    body: optStr(LIMITS.text),
    points: strList(LIMITS.short * 2, 6),
    invite: optStr(LIMITS.title * 2),
    cta: str(LIMITS.short),
    example: str(LIMITS.short),
    /** Headline of the example reading (its pair hero). */
    exampleTitle: optStr(LIMITS.title).default(""),
    pair: z.tuple([pairPerson, pairPerson]),
    goodFor: strList(LIMITS.short, 6),
    cautionFor: strList(LIMITS.short, 6).default([]),
  }),
  people: z.object({
    eyebrow: optStr(LIMITS.short * 2),
    title: str(LIMITS.title),
    body: optStr(LIMITS.text),
    relations: z.array(labelledAvatar).max(12),
  }),
  how: z.object({
    title: str(LIMITS.title),
    steps: z.array(z.object({ title: str(LIMITS.title), body: optStr(LIMITS.text) })).max(6),
  }),
  wallet: z.object({ title: str(LIMITS.title), subtitle: optStr(LIMITS.text) }),
  faq: z.object({
    title: str(LIMITS.title),
    items: z.array(z.object({ q: str(LIMITS.title * 2), a: str(LIMITS.long) })).max(20),
  }),
  final: z.object({ title: str(LIMITS.title), body: optStr(LIMITS.text), cta: str(LIMITS.short) }),
};

/** Sections below the first screen, in the order and visibility the admin chooses. */
export const BODY_SECTIONS = [
  "daily",
  "stats",
  "products",
  "synastry",
  "people",
  "how",
  "wallet",
  "faq",
  "final",
] as const;
export type BodySection = (typeof BODY_SECTIONS)[number];

const layoutSchema = z
  .array(z.object({ key: z.enum(BODY_SECTIONS), visible: z.boolean() }))
  .refine((l) => new Set(l.map((x) => x.key)).size === l.length, { message: "duplicate_section" });

export const landingContentSchema = z.object({
  ...SECTION_SCHEMAS,
  layout: layoutSchema,
});

export type LandingContent = z.infer<typeof landingContentSchema>;
export type SectionKey = keyof typeof SECTION_SCHEMAS;

const l = mn.landing;

export const LANDING_DEFAULTS: LandingContent = {
  seo: { title: l.hero.title, description: l.metaDescription },
  hero: {
    eyebrow: l.hero.eyebrow,
    title: l.hero.title,
    subtitle: l.hero.subtitle,
    pickBirthday: l.planets.pickBirthday,
    hint: l.planets.hint,
  },
  demo: {
    people: [
      { id: "mom", name: "Ээж", birthDate: "1968-03-05", gender: "female", seed: 2, tint: "bg-tint-2" },
      { id: "dad", name: "Аав", birthDate: "1965-11-12", gender: "male", seed: 9, tint: "bg-tint-3" },
      { id: "love", name: "Хайрт", birthDate: "1997-08-02", gender: "female", seed: 11, tint: "bg-tint-1" },
      { id: "friend", name: "Найз", birthDate: "1996-04-10", gender: "male", seed: 10, tint: "bg-tint-3" },
      { id: "sib", name: "Дүү", birthDate: "2003-01-08", gender: "female", seed: 13, tint: "bg-tint-2" },
    ],
    links: [
      {
        id: "mom-dad",
        a: "mom",
        b: "dad",
        goodFor: ["Гэрлэлт", "Гэр бүл"],
        cautionFor: ["Ажил"],
        text: l.planets.linkTexts.momDad,
      },
      {
        id: "mom-sib",
        a: "mom",
        b: "sib",
        goodFor: ["Эцэг эх-Хүүхэд", "Гэр бүл"],
        cautionFor: ["Бизнесийн түнш"],
        text: l.planets.linkTexts.momSib,
      },
      {
        id: "love-friend",
        a: "love",
        b: "friend",
        goodFor: ["Нөхөрлөл", "Ажил"],
        cautionFor: ["Хайр дурлал"],
        text: l.planets.linkTexts.loveFriend,
      },
      {
        id: "sib-friend",
        a: "sib",
        b: "friend",
        goodFor: ["Ах дүү", "Нөхөрлөл"],
        cautionFor: ["Гэрлэлт"],
        text: l.planets.linkTexts.sibFriend,
      },
    ],
    goodLabel: l.planets.goodLabel,
    cautionLabel: l.planets.cautionLabel,
    example: l.planets.example,
    cta: l.planets.checkYours,
  },
  daily: { ...l.daily },
  stats: { items: l.stats.map((s) => ({ value: s.value, label: s.label })) },
  products: {
    title: l.productsTitle,
    subtitle: l.productsSubtitle,
    open: l.open,
    items: Object.entries(l.productHooks).map(([code, hook]) => ({
      code,
      hook,
      badge: l.productBadges[code] ?? "",
    })),
  },
  synastry: {
    eyebrow: l.synastry.eyebrow,
    title: l.synastry.title,
    body: l.synastry.body,
    points: [...l.synastry.points],
    invite: l.synastry.invite,
    cta: l.synastry.cta,
    example: l.synastry.example,
    exampleTitle: "Бие биеэ нөхдөг хос",
    pair: [
      { label: l.synastry.pair[0], birthDate: "1994-05-21", gender: "male", seed: 3 },
      { label: l.synastry.pair[1], birthDate: "1997-08-02", gender: "female", seed: 5 },
    ],
    goodFor: ["Гэрлэлт", "Хайр дурлал"],
    cautionFor: ["Ажил"],
  },
  people: {
    eyebrow: l.people.eyebrow,
    title: l.people.title,
    body: l.people.body,
    // Ээж, Аав, Хайрт, Найз, Дүү, Хүүхэд, Краш, Хамт ажиллагч
    relations: l.people.relations.map((label, i) => ({
      label,
      ...([
        { gender: "female", seed: 27 },
        { gender: "male", seed: 4 },
        { gender: "female", seed: 5 },
        { gender: "male", seed: 1 },
        { gender: "female", seed: 24 },
        { gender: "male", seed: 6 },
        { gender: "female", seed: 20 },
        { gender: "male", seed: 12 },
      ] as const)[i % 8],
    })),
  },
  how: { title: l.how.title, steps: l.how.steps.map((s) => ({ ...s })) },
  wallet: { title: l.wallet.title, subtitle: l.wallet.subtitle },
  faq: { title: l.faqTitle, items: l.faq.map((f) => ({ ...f })) },
  final: { ...l.final },
  layout: BODY_SECTIONS.map((key) => ({ key, visible: true })),
};

/**
 * Stored JSON → content, section by section: a section that fails its schema keeps the default.
 * Layout keeps the stored order, drops unknown/duplicate keys and appends sections it lacks.
 */
export function mergeLandingContent(raw: unknown): LandingContent {
  const src = upgradeLegacy(raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {});
  const out = { ...LANDING_DEFAULTS } as Record<string, unknown>;
  for (const key of Object.keys(SECTION_SCHEMAS) as SectionKey[]) {
    const parsed = SECTION_SCHEMAS[key].safeParse(src[key]);
    if (parsed.success) out[key] = parsed.data;
  }
  const layout: LandingContent["layout"] = [];
  if (Array.isArray(src.layout)) {
    for (const item of src.layout) {
      const parsed = z.object({ key: z.enum(BODY_SECTIONS), visible: z.boolean() }).safeParse(item);
      if (parsed.success && !layout.some((x) => x.key === parsed.data.key)) layout.push(parsed.data);
    }
  }
  // A section added since the content was saved goes in at its default place: right after the
  // nearest section that precedes it in BODY_SECTIONS, else right before the nearest that
  // follows it, else at the end.
  const at = (k: BodySection) => layout.findIndex((x) => x.key === k);
  BODY_SECTIONS.forEach((key, i) => {
    if (at(key) >= 0) return;
    const prev = BODY_SECTIONS.slice(0, i).reverse().map(at).find((j) => j >= 0);
    const next = BODY_SECTIONS.slice(i + 1).map(at).find((j) => j >= 0);
    const pos = prev !== undefined ? prev + 1 : next !== undefined ? next : layout.length;
    layout.splice(pos, 0, { key, visible: true });
  });
  out.layout = layout;
  return out as LandingContent;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * Content saved before avatars had a gender (first CMS version): demo people get the gender
 * their drawing shows, plain relation labels and pair labels get the default drawings. Content
 * saved before the synastry example had dates gets the default ones.
 * Returns a copy; current-shape content passes through unchanged.
 */
export function upgradeLegacy(src: Obj): Obj {
  const out: Obj = { ...src };
  if (isObj(src.demo) && Array.isArray(src.demo.people)) {
    out.demo = {
      ...src.demo,
      people: src.demo.people.map((p) =>
        isObj(p) && !("gender" in p) && typeof p.seed === "number"
          ? {
              ...p,
              gender:
                avatarGender(AVATAR_SEEDS[p.seed] ?? AVATAR_SEEDS[0]) === "male" ? "male" : "female",
            }
          : p,
      ),
    };
  }
  if (isObj(src.people) && Array.isArray(src.people.relations)) {
    const defaults = LANDING_DEFAULTS.people.relations;
    out.people = {
      ...src.people,
      relations: src.people.relations.map((r, i) => {
        if (typeof r !== "string") return r;
        const d = defaults[i % defaults.length];
        return { label: r, gender: d.gender, seed: d.seed };
      }),
    };
  }
  if (isObj(src.synastry) && Array.isArray(src.synastry.pair)) {
    // Saved before the example looked like a real pair reading (no `exampleTitle` key yet):
    // it gets the default headline, birth dates and challenging relations.
    const d = LANDING_DEFAULTS.synastry;
    const before = !("exampleTitle" in src.synastry);
    out.synastry = {
      ...src.synastry,
      ...(before && { exampleTitle: d.exampleTitle, cautionFor: d.cautionFor }),
      pair: src.synastry.pair.map((v, i) => {
        const def = d.pair[i % 2];
        if (typeof v === "string") return { ...def, label: v };
        return before && isObj(v) && !("birthDate" in v) ? { ...v, birthDate: def.birthDate } : v;
      }),
    };
  }
  return out;
}

export type PriceTokens = { minPrice: string; birthdayPrice: string; synastryPrice: string };

/** "{minPrice}-өөс" → "1,000₮-өөс". Unknown tokens are left as typed. */
export function fillTokens(text: string, tokens: PriceTokens): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in tokens ? tokens[k as keyof PriceTokens] : m,
  );
}

export type IssueCode =
  | "too_small"
  | "too_big"
  | "invalid_date"
  | "bad_pair"
  | "avatar_gender"
  | "duplicate"
  | "invalid";

/** Zod issues → { "demo.people.0.name": "too_small" }, for showing errors next to fields. */
export function issuesByPath(error: z.ZodError): Record<string, IssueCode> {
  const out: Record<string, IssueCode> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key in out) continue;
    out[key] =
      issue.code === "too_small" || issue.code === "too_big"
        ? issue.code
        : issue.message === "invalid_date" ||
            issue.message === "bad_pair" ||
            issue.message === "avatar_gender"
          ? issue.message
          : issue.message.startsWith("duplicate")
            ? "duplicate"
            : "invalid";
  }
  return out;
}
