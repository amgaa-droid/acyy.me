import { describe, expect, it } from "vitest";

import { PRODUCTS } from "@/server/db/seed-data";
import { APP_REFERENCED_ROWS, appUses, appUsesOf } from "./catalog-refs";

describe("catalog rows the app refers to", () => {
  it("says which screens a change would empty", () => {
    expect(appUsesOf({ product: "birthday" }, "deactivate")).toEqual([
      "landing_reveal",
      "landing_price",
      "first_reading",
    ]);
    expect(appUsesOf({ product: "synastry" }, "delete")).toEqual(["pair_default", "landing_price"]);
    expect(appUsesOf({ product: "birthday", part: "main" }, "rekey")).toContain("landing_reveal");
    const strengths = { product: "birthday", part: "main", field: "strengths" };
    for (const change of ["archive", "delete", "prose"] as const) {
      expect(appUsesOf(strengths, change)).toEqual(["share_strengths"]);
    }
  });

  it("leaves everything else alone", () => {
    expect(appUsesOf({ product: "sign" }, "deactivate")).toEqual([]);
    expect(appUsesOf({ product: "birthday", part: "main", field: "health" }, "archive")).toEqual(
      [],
    );
    // Same field code in another product is not the one the share card reads.
    expect(
      appUsesOf({ product: "synastry", part: "period_pair", field: "strengths" }, "archive"),
    ).toEqual([]);
    // A part is not its product: archiving the part doesn't stop the product being sold.
    expect(appUsesOf({ product: "birthday", part: "main" }, "deactivate")).toEqual([]);
    expect(appUses({ product: "love" })).toEqual([]);
  });

  it("only names rows that exist in the launch catalogue", () => {
    for (const row of APP_REFERENCED_ROWS) {
      const product = PRODUCTS.find((p) => p.code === row.product);
      expect(product, row.product).toBeDefined();
      if (!row.part) continue;
      const part = product!.parts.find((p) => p.code === row.part);
      expect(part, `${row.product}.${row.part}`).toBeDefined();
      if (row.field) {
        expect(
          part!.fields.some((f) => f.code === row.field),
          `${row.product}.${row.part}.${row.field}`,
        ).toBe(true);
      }
    }
  });
});
