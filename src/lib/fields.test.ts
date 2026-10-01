import { describe, expect, it } from "vitest";

import { fieldItems, fieldValue } from "./fields";

describe("fieldItems", () => {
  it("splits item kinds per line, strips bullets and duplicates", () => {
    expect(fieldItems("• Түшигтэй\n- Тачаангуй\r\n\n• Түшигтэй", "list")).toEqual([
      "Түшигтэй",
      "Тачаангуй",
    ]);
  });

  it("chips and alert also split on commas; cards keep them", () => {
    expect(fieldItems("Гэрлэлт, Хамтрагч\nНайз", "chips")).toEqual(["Гэрлэлт", "Хамтрагч", "Найз"]);
    expect(fieldItems("Гэрлэлт, Хамтрагч", "alert")).toEqual(["Гэрлэлт", "Хамтрагч"]);
    expect(fieldItems("Амар, тайван бай.\nИнээ.", "cards")).toEqual(["Амар, тайван бай.", "Инээ."]);
  });
});

describe("fieldValue", () => {
  it("returns trimmed text or null for missing/blank", () => {
    expect(fieldValue({ a: "  x \n" }, "a")).toBe("x");
    expect(fieldValue({ a: "  " }, "a")).toBeNull();
    expect(fieldValue({}, "a")).toBeNull();
  });
});
