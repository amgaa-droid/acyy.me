import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  FIELD_KINDS,
  GENDERS,
  KEY_TYPES,
  PRODUCT_ICONS,
  PRODUCT_TINTS,
  RELATIONS,
  type FieldKind,
  type Gender,
  type KeyType,
} from "../../lib/domain";

const inList = (column: string, values: readonly string[]) =>
  sql.raw(`${column} IN (${values.map((v) => `'${v}'`).join(", ")})`);

/**
 * Column names are snake_case via `casing: "snake_case"` (see db/index.ts, drizzle.config.ts).
 * Money columns are integer MNT in `bigint` (mode number) — never float.
 */

const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const money = () => bigint({ mode: "number" });

// ---------- Enums ----------

export const relationEnum = pgEnum("relation", RELATIONS);
export const genderEnum = pgEnum("gender", GENDERS);
export const contentStatusEnum = pgEnum("content_status", ["draft", "published"]);
export const walletEntryTypeEnum = pgEnum("wallet_entry_type", [
  "topup",
  "bonus",
  "purchase",
  "refund",
  "adjust",
]);
export const topupStatusEnum = pgEnum("topup_status", ["pending", "paid", "expired", "failed"]);
export const invitationChannelEnum = pgEnum("invitation_channel", ["link", "email"]);
export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "revoked",
  "expired",
]);

// ---------- Auth (Better Auth: user, session, account, verification) ----------

export const user = pgTable("user", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  adultConfirmedAt: timestamp({ withTimezone: true }),
  /** First-run guide progress: step → when it was done (src/server/onboarding.ts). */
  onboarding: jsonb().$type<Record<string, string>>().notNull().default({}),
  deletedAt: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const session = pgTable(
  "session",
  {
    id: uuid().primaryKey().defaultRandom(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    token: text().notNull().unique(),
    ipAddress: text(),
    userAgent: text(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: uuid().primaryKey().defaultRandom(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    createdAt: createdAt(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: uuid().primaryKey().defaultRandom(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ---------- People ----------

export const persons = pgTable(
  "persons",
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerUserId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    isSelf: boolean().notNull().default(false),
    relation: relationEnum().notNull(),
    relationLabel: text(),
    name: text().notNull(),
    gender: genderEnum().notNull().default("unspecified"),
    // Immutable after insert (CLAUDE.md rule 2). Stored as 'YYYY-MM-DD'.
    birthDate: date({ mode: "string" }).notNull(),
    avatarSeed: text().notNull(),
    linkedUserId: uuid().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex("persons_one_self_per_owner")
      .on(t.ownerUserId)
      .where(sql`${t.isSelf} AND ${t.deletedAt} IS NULL`),
    index("persons_owner_idx").on(t.ownerUserId),
    index("persons_linked_user_idx").on(t.linkedUserId),
    check("persons_self_relation", sql`${t.isSelf} = (${t.relation} = 'self')`),
    check("persons_name_len", sql`char_length(${t.name}) BETWEEN 1 AND 40`),
    check(
      "persons_relation_label_len",
      sql`${t.relationLabel} IS NULL OR char_length(${t.relationLabel}) <= 20`,
    ),
  ],
);

// ---------- Astrology reference tables ----------

export const zodiacSigns = pgTable("zodiac_signs", {
  code: text().primaryKey(),
  nameMn: text().notNull(),
  startMd: char({ length: 5 }).notNull(),
  endMd: char({ length: 5 }).notNull(),
  sort: integer().notNull(),
});

export const periods48 = pgTable(
  "periods48",
  {
    no: integer().primaryKey(),
    startMd: char({ length: 5 }).notNull(),
    endMd: char({ length: 5 }).notNull(),
    label: text(),
  },
  (t) => [check("periods48_no_range", sql`${t.no} BETWEEN 1 AND 48`)],
);

// ---------- Catalog & content ----------

export const products = pgTable(
  "products",
  {
    code: text().primaryKey(),
    nameMn: text().notNull(),
    description: text().notNull().default(""),
    price: money().notNull(),
    personCount: integer().notNull(),
    allowedGroups: text().array().notNull(),
    adultOnly: boolean().notNull().default(false),
    isActive: boolean().notNull().default(true),
    sort: integer().notNull().default(0),
    icon: text().notNull().default("sparkles"),
    tint: text().notNull().default("tint-1"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("products_price_nonneg", sql`${t.price} >= 0`),
    check("products_person_count", sql`${t.personCount} IN (1, 2)`),
    check("products_icon", inList("icon", PRODUCT_ICONS)),
    check("products_tint", inList("tint", PRODUCT_TINTS)),
  ],
);

/**
 * A product's texts come in 1+ parts (synastry: sign pair + period pair), each keyed by its
 * `key_type` (SPEC §3). `by_gender` (1-person parts only) doubles the keys: "aries|male".
 */
export const productParts = pgTable(
  "product_parts",
  {
    productCode: text()
      .notNull()
      .references(() => products.code, { onUpdate: "cascade", onDelete: "cascade" }),
    code: text().notNull(),
    nameMn: text().notNull(),
    keyType: text().$type<KeyType>().notNull(),
    byGender: boolean().notNull().default(false),
    sort: integer().notNull().default(0),
    /**
     * Archived parts are no longer sold, imported or counted; readings bought while the part
     * was active keep showing it (their snapshot has its key).
     */
    archivedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.productCode, t.code] }),
    check("product_parts_key_type", inList("key_type", KEY_TYPES)),
  ],
);

/**
 * Sub-sections of a part's text ("Давуу тал", "Бясалгах үг"…). `kind` picks the reading-screen
 * presentation; `is_free` ones are shown in the paywall preview. Archived fields stay in the
 * stored texts but are no longer shown, imported or edited.
 */
export const productFields = pgTable(
  "product_fields",
  {
    productCode: text().notNull(),
    partCode: text().notNull(),
    code: text().notNull(),
    nameMn: text().notNull(),
    kind: text().$type<FieldKind>().notNull(),
    isFree: boolean().notNull().default(false),
    required: boolean().notNull().default(false),
    sort: integer().notNull().default(0),
    archivedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.productCode, t.partCode, t.code] }),
    foreignKey({
      columns: [t.productCode, t.partCode],
      foreignColumns: [productParts.productCode, productParts.code],
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    check("product_fields_kind", inList("kind", FIELD_KINDS)),
  ],
);

/** Field code → text. Item kinds (list, cards…) hold one item per line. */
export type ContentFields = Record<string, string>;

export const contentEntries = pgTable(
  "content_entries",
  {
    id: uuid().primaryKey().defaultRandom(),
    productCode: text()
      .notNull()
      .references(() => products.code, { onUpdate: "cascade" }),
    /** The product part's code. */
    section: text().notNull(),
    key: text().notNull(),
    title: text().notNull(),
    fields: jsonb().$type<ContentFields>().notNull().default({}),
    /** Free teaser shown in the paywall preview as-is (SPEC §3.1); null = none. */
    teaser: text(),
    score: integer(),
    status: contentStatusEnum().notNull().default("draft"),
    updatedBy: uuid().references(() => user.id, { onDelete: "set null" }),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("content_entries_product_section_key").on(t.productCode, t.section, t.key),
    foreignKey({
      name: "content_entries_part_fk",
      columns: [t.productCode, t.section],
      foreignColumns: [productParts.productCode, productParts.code],
    }).onUpdate("cascade"),
    check("content_entries_score", sql`${t.score} IS NULL OR ${t.score} BETWEEN 0 AND 100`),
  ],
);

// ---------- Wallet (mutate ONLY via src/server/wallet.ts) ----------

export const wallets = pgTable(
  "wallets",
  {
    userId: uuid()
      .primaryKey()
      .references(() => user.id),
    balance: money().notNull().default(0),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("wallets_balance_nonneg", sql`${t.balance} >= 0`)],
);

export const walletEntries = pgTable(
  "wallet_entries",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => user.id),
    type: walletEntryTypeEnum().notNull(),
    amount: money().notNull(),
    balanceAfter: money().notNull(),
    refType: text(),
    refId: text(),
    idempotencyKey: text().notNull().unique(),
    note: text(),
    createdBy: uuid().references(() => user.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("wallet_entries_user_created_idx").on(t.userId, t.createdAt),
    check("wallet_entries_amount_nonzero", sql`${t.amount} <> 0`),
    check("wallet_entries_balance_after_nonneg", sql`${t.balanceAfter} >= 0`),
  ],
);

/** Top-up packages offered in the wallet (SPEC §4.1), managed at /admin/packages. */
export const topupPackages = pgTable(
  "topup_packages",
  {
    id: uuid().primaryKey().defaultRandom(),
    amount: money().notNull().unique(),
    bonus: money().notNull().default(0),
    isActive: boolean().notNull().default(true),
    sort: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    check("topup_packages_amount_pos", sql`${t.amount} > 0`),
    check("topup_packages_bonus_nonneg", sql`${t.bonus} >= 0`),
  ],
);

export const topups = pgTable(
  "topups",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => user.id),
    /** The package bought; amount/bonus are copied so later package edits don't rewrite history. */
    packageId: uuid().references(() => topupPackages.id, { onDelete: "set null" }),
    amount: money().notNull(),
    bonus: money().notNull().default(0),
    status: topupStatusEnum().notNull().default("pending"),
    provider: text().notNull(),
    invoiceId: text().unique(),
    /** QR image/text + bank deeplinks, so the invoice screen survives a reload. */
    invoiceData: jsonb().$type<InvoiceData>(),
    paymentId: text(),
    paidAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("topups_user_idx").on(t.userId),
    index("topups_status_created_idx").on(t.status, t.createdAt),
    index("topups_paid_at_idx").on(t.paidAt),
    check("topups_amount_pos", sql`${t.amount} > 0`),
    check("topups_bonus_nonneg", sql`${t.bonus} >= 0`),
  ],
);

export type InvoiceData = {
  qrImage: string;
  qrText: string;
  deeplinks: { name: string; logo: string; link: string }[];
};

// ---------- Purchases ----------

export type PurchaseSnapshot = {
  persons: {
    name: string;
    birthDate: string;
    gender: Gender;
    sign: string;
    period: number;
  }[];
  /** Part code → content key. */
  keys: Record<string, string>;
};

export const purchases = pgTable(
  "purchases",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => user.id),
    productCode: text()
      .notNull()
      .references(() => products.code, { onUpdate: "cascade" }),
    pricePaid: money().notNull(),
    // Nullable + SET NULL so persons can be hard-deleted on account deletion; the snapshot keeps the data.
    personAId: uuid().references(() => persons.id, { onDelete: "set null" }),
    personBId: uuid().references(() => persons.id, { onDelete: "set null" }),
    subjectKey: text().notNull(),
    snapshot: jsonb().$type<PurchaseSnapshot>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("purchases_user_product_subject").on(t.userId, t.productCode, t.subjectKey),
    index("purchases_user_idx").on(t.userId, t.createdAt),
    index("purchases_created_idx").on(t.createdAt),
    index("purchases_person_a_idx").on(t.personAId),
    index("purchases_person_b_idx").on(t.personBId),
    check("purchases_price_nonneg", sql`${t.pricePaid} >= 0`),
  ],
);

// ---------- Analytics ----------

/**
 * Paywall previews shown (buy screen, SPEC §3.1): one row per user × product × subject, so
 * "free views → purchases" conversion can be measured on the admin dashboard.
 */
export const previewViews = pgTable(
  "preview_views",
  {
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    productCode: text()
      .notNull()
      .references(() => products.code, { onUpdate: "cascade", onDelete: "cascade" }),
    subjectKey: text().notNull(),
    viewCount: integer().notNull().default(1),
    firstViewedAt: createdAt(),
    lastViewedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.productCode, t.subjectKey] }),
    index("preview_views_first_viewed_idx").on(t.firstViewedAt),
  ],
);

// ---------- Invitations ----------

export const invitations = pgTable(
  "invitations",
  {
    id: uuid().primaryKey().defaultRandom(),
    personId: uuid()
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    inviterUserId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    channel: invitationChannelEnum().notNull(),
    email: text(),
    tokenHash: text().notNull().unique(),
    status: invitationStatusEnum().notNull().default("pending"),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    acceptedBy: uuid().references(() => user.id, { onDelete: "set null" }),
    acceptedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("invitations_person_idx").on(t.personId)],
);

// ---------- Audit ----------

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid().primaryKey().defaultRandom(),
    actorId: uuid().references(() => user.id, { onDelete: "set null" }),
    action: text().notNull(),
    entity: text().notNull(),
    entityId: text(),
    data: jsonb(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_logs_entity_idx").on(t.entity, t.entityId)],
);

// ---------- Site pages (admin CMS) ----------

/**
 * The one working draft of an editable page (e.g. "landing"). `revision` grows on every save so
 * two admins editing at once can't silently overwrite each other (optimistic concurrency).
 */
export const pageDrafts = pgTable("page_drafts", {
  page: text().primaryKey(),
  content: jsonb().notNull(),
  revision: integer().notNull().default(1),
  baseVersion: integer(),
  updatedBy: uuid().references(() => user.id, { onDelete: "set null" }),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** Append-only published versions; the highest `version` per page is live. */
export const pageVersions = pgTable(
  "page_versions",
  {
    id: uuid().primaryKey().defaultRandom(),
    page: text().notNull(),
    version: integer().notNull(),
    content: jsonb().notNull(),
    note: text(),
    publishedBy: uuid().references(() => user.id, { onDelete: "set null" }),
    publishedAt: createdAt(),
  },
  (t) => [unique("page_versions_page_version_uq").on(t.page, t.version)],
);
