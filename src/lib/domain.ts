/** Shared domain constants (SPEC §2.2, §3). Safe to import from client and server. */

export const RELATIONS = [
  "self",
  "mother",
  "father",
  "older_brother",
  "older_sister",
  "younger_sibling",
  "child",
  "partner",
  "crush",
  "friend",
  "coworker",
  "other",
] as const;
export type Relation = (typeof RELATIONS)[number];

export const RELATION_GROUPS = ["self", "family", "romantic", "friend", "other"] as const;
export type RelationGroup = (typeof RELATION_GROUPS)[number];

export const RELATION_GROUP: Record<Relation, RelationGroup> = {
  self: "self",
  mother: "family",
  father: "family",
  older_brother: "family",
  older_sister: "family",
  younger_sibling: "family",
  child: "family",
  partner: "romantic",
  crush: "romantic",
  friend: "friend",
  coworker: "other",
  other: "other",
};

export const GENDERS = ["male", "female", "unspecified"] as const;
export type Gender = (typeof GENDERS)[number];

/** Code of a product, product part or field: lowercase latin, digits, "_" (e.g. "birthday"). */
export const CODE_PATTERN = /^[a-z][a-z0-9_]{1,31}$/;

/**
 * What a product part's texts are keyed by (SPEC §3). Arity = how many people the key needs.
 * Pair keys are "A|B"; unordered ones are sorted (A×B = B×A), `sign_pair_ordered` keeps the order.
 */
export const KEY_TYPES = [
  "month_day",
  "sign",
  "period",
  "sign_pair",
  "period_pair",
  "sign_pair_ordered",
] as const;
export type KeyType = (typeof KEY_TYPES)[number];

export const KEY_TYPE_ARITY: Record<KeyType, 1 | 2> = {
  month_day: 1,
  sign: 1,
  period: 1,
  sign_pair: 2,
  period_pair: 2,
  sign_pair_ordered: 2,
};

/** Genders a gender-split text exists for; "unspecified" must be chosen before buying. */
export const KEY_GENDERS = ["male", "female"] as const;
export type KeyGender = (typeof KEY_GENDERS)[number];

/**
 * How a sub-section (field) of a text is shown on the reading screen.
 * text/quote/cards go into the article; list/chips/alert are summary cards next to the hero.
 */
export const FIELD_KINDS = ["text", "quote", "cards", "list", "chips", "alert"] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

/** Kinds whose value is one item per line (bullets and, for chips/alert, commas too). */
export const ITEM_FIELD_KINDS: readonly FieldKind[] = ["cards", "list", "chips", "alert"];
export const SUMMARY_FIELD_KINDS: readonly FieldKind[] = ["list", "chips", "alert"];

/** Product tile icons and colours (admin picks one; rendered by ProductIcon). */
export const PRODUCT_ICONS = [
  "calendar",
  "sparkles",
  "heart",
  "flame",
  "coffee",
  "blend",
  "moon",
  "sun",
  "star",
  "gem",
  "baby",
  "briefcase",
  "leaf",
  "users",
] as const;
export type ProductIconName = (typeof PRODUCT_ICONS)[number];

export const PRODUCT_TINTS = ["highlight", "tint-1", "tint-2", "tint-3", "dark", "nav"] as const;
export type ProductTint = (typeof PRODUCT_TINTS)[number];
