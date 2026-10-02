import { createReadStream } from "node:fs";

/**
 * Reader for SQL Server "Generate Scripts" data dumps (the old acyy.me database): UTF-16LE,
 * CRLF, one `INSERT [dbo].[T] (cols) VALUES (…)` per row, string values may span lines.
 * Values: N'…' / '…' (with '' escapes), NULL, numbers, CAST(0x… AS DateTime).
 */

type SqlValue = string | number | null;
export type SqlRow = Record<string, SqlValue>;

const HEAD = /^INSERT \[dbo\]\.\[(\w+)\] \((.*?)\) VALUES \(/;

/** SQL Server `datetime` binary: 4-byte days since 1900-01-01 + 4-byte 1/300 s ticks. → ISO (UTC-less). */
export function decodeDateTime(hex: string): string {
  const n = BigInt(hex);
  let days = Number(n >> BigInt(32));
  if (days >= 2 ** 31) days -= 2 ** 32;
  const ticks = Number(n & BigInt(0xffffffff));
  const ms = Date.UTC(1900, 0, 1) + days * 86_400_000 + Math.round((ticks * 10) / 3);
  return new Date(ms).toISOString().replace("Z", "");
}

/**
 * Parses the VALUES list of one statement, starting right after "VALUES (".
 * Returns null while the statement is still incomplete (a string runs onto the next line).
 */
export function parseValues(s: string): SqlValue[] | null {
  const out: SqlValue[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === " " || c === ",") {
      i++;
      continue;
    }
    if (c === ")") return out;
    if (c === "'" || (c === "N" && s[i + 1] === "'")) {
      i += c === "N" ? 2 : 1;
      let buf = "";
      for (;;) {
        const j = s.indexOf("'", i);
        if (j < 0) return null;
        buf += s.slice(i, j);
        if (s[j + 1] === "'") {
          buf += "'";
          i = j + 2;
        } else {
          i = j + 1;
          break;
        }
      }
      out.push(buf);
      continue;
    }
    const rest = s.slice(i);
    const cast = /^CAST\((0x[0-9A-F]+) AS DateTime\)/i.exec(rest);
    if (cast) {
      out.push(decodeDateTime(cast[1]));
      i += cast[0].length;
      continue;
    }
    const lit = /^(NULL|-?\d+(?:\.\d+)?(?:E[-+]?\d+)?)/i.exec(rest);
    if (!lit) throw new Error(`unexpected SQL value: ${rest.slice(0, 60)}`);
    out.push(lit[1].toUpperCase() === "NULL" ? null : Number(lit[1]));
    i += lit[0].length;
  }
  return null;
}

/** Line-by-line statement assembler; feed lines, get complete rows of the wanted tables. */
export function createInsertParser(tables: ReadonlySet<string>) {
  let pending: { table: string; cols: string[]; text: string } | null = null;
  return (line: string): { table: string; row: SqlRow } | null => {
    if (!pending) {
      const m = HEAD.exec(line);
      if (!m || !tables.has(m[1])) return null;
      pending = {
        table: m[1],
        cols: m[2].split(",").map((c) => c.trim().replace(/^\[|\]$/g, "")),
        text: line.slice(m[0].length),
      };
    } else {
      pending.text += `\n${line}`;
    }
    const values = parseValues(pending.text);
    if (!values) return null;
    const { table, cols } = pending;
    pending = null;
    if (values.length !== cols.length) {
      throw new Error(`${table}: ${values.length} values for ${cols.length} columns`);
    }
    return { table, row: Object.fromEntries(cols.map((c, k) => [c, values[k]])) };
  };
}

/** Streams a UTF-16LE dump file and collects the rows of the given tables. */
export async function readDump(path: string, tables: string[]): Promise<Record<string, SqlRow[]>> {
  const wanted = new Set(tables);
  const result: Record<string, SqlRow[]> = Object.fromEntries(tables.map((t) => [t, []]));
  const feed = createInsertParser(wanted);
  const decoder = new TextDecoder("utf-16le");
  let carry = "";
  for await (const chunk of createReadStream(path, { highWaterMark: 1 << 22 })) {
    carry += decoder.decode(chunk as Buffer, { stream: true });
    const lines = carry.split("\r\n");
    carry = lines.pop()!;
    for (const line of lines) {
      const hit = feed(line.replace(/^﻿/, ""));
      if (hit) result[hit.table].push(hit.row);
    }
  }
  carry += decoder.decode();
  for (const line of carry.split("\r\n")) {
    const hit = feed(line);
    if (hit) result[hit.table].push(hit.row);
  }
  return result;
}
