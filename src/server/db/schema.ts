import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  CONTENT_SECTIONS,
  GENDERS,
  RELATIONS,
  type ContentSection,
  type Gender,
} from "../../lib/domain";

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
  },
  (t) => [
    check("products_price_nonneg", sql`${t.price} >= 0`),
    check("products_person_count", sql`${t.personCount} IN (1, 2)`),
  ],
);

export const contentEntries = pgTable(
  "content_entries",
  {
    id: uuid().primaryKey().defaultRandom(),
    productCode: text()
      .notNull()
      .references(() => products.code, { onUpdate: "cascade" }),
    section: text().$type<ContentSection>().notNull(),
    key: text().notNull(),
    title: text().notNull(),
    body: text().notNull(),
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
    check(
      "content_entries_section",
      sql.raw(`section IN (${CONTENT_SECTIONS.map((s) => `'${s}'`).join(", ")})`),
    ),
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

export const topups = pgTable(
  "topups",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => user.id),
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
  keys: Partial<Record<ContentSection, string>>;
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
    index("purchases_person_a_idx").on(t.personAId),
    index("purchases_person_b_idx").on(t.personBId),
    check("purchases_price_nonneg", sql`${t.pricePaid} >= 0`),
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
