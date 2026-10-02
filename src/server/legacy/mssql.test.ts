import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { createInsertParser, decodeDateTime, parseValues, readDump } from "./mssql";

describe("decodeDateTime", () => {
  it("decodes SQL Server datetime binaries (days since 1900 + 1/300 s ticks)", () => {
    expect(decodeDateTime("0x0000B25200000000")).toBe("2024-12-26T00:00:00.000");
    expect(decodeDateTime("0x0000A7B200F2C0DB")).toBe("2017-07-16T14:43:50.277");
  });
});

describe("parseValues", () => {
  it("reads strings with '' escapes, N prefixes, NULL, numbers and dates", () => {
    expect(
      parseValues("1, N'Би''с', NULL, -2.5, 'x', CAST(0x0000B25200000000 AS DateTime), N'a, b)')"),
    ).toEqual([1, "Би'с", null, -2.5, "x", "2024-12-26T00:00:00.000", "a, b)"]);
  });

  it("returns null while a string is still open (value continues on the next line)", () => {
    expect(parseValues("1, N'first line")).toBeNull();
    expect(parseValues("1, N'first line\nsecond')")).toEqual([1, "first line\nsecond"]);
  });
});

describe("createInsertParser", () => {
  it("assembles multi-line statements and ignores other tables", () => {
    const feed = createInsertParser(new Set(["T"]));
    expect(feed("INSERT [dbo].[Other] ([a]) VALUES (1)")).toBeNull();
    expect(feed("INSERT [dbo].[T] ([id], [text]) VALUES (7, N'line one")).toBeNull();
    expect(feed("line two')")).toEqual({ table: "T", row: { id: 7, text: "line one\nline two" } });
    expect(feed("GO")).toBeNull();
  });

  it("fails loudly on a column/value mismatch", () => {
    const feed = createInsertParser(new Set(["T"]));
    expect(() => feed("INSERT [dbo].[T] ([a], [b]) VALUES (1)")).toThrow(/1 values for 2/);
  });
});

describe("readDump", () => {
  it("streams a UTF-16LE CRLF file", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "mssql-"));
    const file = path.join(dir, "dump.sql");
    const text = [
      "USE [x]",
      "INSERT [dbo].[Users] ([UserID], [Email]) VALUES (1, N'a@b.mn')",
      "INSERT [dbo].[Users] ([UserID], [Email]) VALUES (2, NULL)",
      "GO",
      "",
    ].join("\r\n");
    await writeFile(file, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]));
    expect(await readDump(file, ["Users"])).toEqual({
      Users: [
        { UserID: 1, Email: "a@b.mn" },
        { UserID: 2, Email: null },
      ],
    });
  });
});
