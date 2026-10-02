/**
 * Catalog rows the app's own screens refer to by code. Products, parts and fields are data the
 * Owner manages in /admin/products, but a few screens are built around the launch catalogue:
 * the landing's birthday reveal, the share card's list, the reading a new pair opens. This is
 * the one place those codes live — the screens import them from here, and the admin catalogue
 * uses the same list to ask before a change that would quietly empty one of those screens.
 * Safe to import from client and server.
 */

export const BIRTHDAY_PRODUCT = "birthday";
/** The birthday text itself (keyed by month-day): the landing reveal previews this part. */
export const BIRTHDAY_PART = "main";
/** Its "Давуу тал" items, listed on the birthday share card. */
export const STRENGTHS_FIELD = "strengths";
export const SYNASTRY_PRODUCT = "synastry";
/** Synastry's relation chips, offered as suggestions in the landing editor. */
export const RELATION_CHIP_FIELDS = ["good_for", "caution_for"] as const;
/** Readings that make a share card (the rest share selected text only). */
export const SHARE_CARD_PRODUCTS: readonly string[] = [BIRTHDAY_PRODUCT, SYNASTRY_PRODUCT];

/** A screen that depends on a catalog row. */
export const APP_USES = [
  "landing_reveal",
  "landing_price",
  "first_reading",
  "share_strengths",
  "pair_default",
] as const;
export type AppUse = (typeof APP_USES)[number];

/**
 * What an admin can do to a row: stop selling a product / delete it, archive or delete a part or
 * a field, change what a part's texts are keyed by, or turn an item field into prose.
 */
export type CatalogChange = "deactivate" | "delete" | "archive" | "rekey" | "prose";

export type CatalogTarget = { product: string; part?: string; field?: string };

const REFS: { target: CatalogTarget; changes: CatalogChange[]; uses: AppUse[] }[] = [
  {
    target: { product: BIRTHDAY_PRODUCT },
    changes: ["deactivate", "delete"],
    uses: ["landing_reveal", "landing_price", "first_reading"],
  },
  {
    target: { product: BIRTHDAY_PRODUCT, part: BIRTHDAY_PART },
    changes: ["archive", "delete", "rekey"],
    uses: ["landing_reveal", "share_strengths"],
  },
  {
    target: { product: BIRTHDAY_PRODUCT, part: BIRTHDAY_PART, field: STRENGTHS_FIELD },
    changes: ["archive", "delete", "prose"],
    uses: ["share_strengths"],
  },
  {
    target: { product: SYNASTRY_PRODUCT },
    changes: ["deactivate", "delete"],
    uses: ["pair_default", "landing_price"],
  },
];

const same = (a: CatalogTarget, b: CatalogTarget) =>
  a.product === b.product &&
  (a.part ?? null) === (b.part ?? null) &&
  (a.field ?? null) === (b.field ?? null);

/** The screens that lose something if this row is changed this way ([] = none). */
export function appUsesOf(target: CatalogTarget, change: CatalogChange): AppUse[] {
  return REFS.filter((r) => same(r.target, target) && r.changes.includes(change)).flatMap(
    (r) => r.uses,
  );
}

/** Every screen that depends on this row, whatever the change — for the admin's badge. */
export function appUses(target: CatalogTarget): AppUse[] {
  return REFS.filter((r) => same(r.target, target)).flatMap((r) => r.uses);
}

/** The rows above, so a test can check each still exists in the seeded catalogue. */
export const APP_REFERENCED_ROWS: readonly CatalogTarget[] = REFS.map((r) => r.target);
