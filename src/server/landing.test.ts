import { describe, expect, it } from "vitest";

import { parseRevealInput } from "./landing";

describe("parseRevealInput", () => {
  it("pads month and day", () => {
    expect(parseRevealInput({ month: "4", day: "2" })).toBe("04-02");
    expect(parseRevealInput({ month: 12, day: 31 })).toBe("12-31");
  });

  it("accepts 02-29", () => {
    expect(parseRevealInput({ month: "2", day: "29" })).toBe("02-29");
  });

  it.each([
    { month: "2", day: "30" },
    { month: "4", day: "31" },
    { month: "13", day: "1" },
    { month: "0", day: "10" },
    { month: "1", day: "0" },
    { month: "x", day: "1" },
    {},
    null,
  ])("rejects %o", (input) => {
    expect(parseRevealInput(input)).toBeNull();
  });
});
