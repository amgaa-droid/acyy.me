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

export const CONTENT_SECTIONS = ["main", "sign_pair", "period_pair"] as const;
export type ContentSection = (typeof CONTENT_SECTIONS)[number];

export const PRODUCT_CODES = ["birthday", "sign", "love", "sex", "dating", "synastry"] as const;
export type ProductCode = (typeof PRODUCT_CODES)[number];
