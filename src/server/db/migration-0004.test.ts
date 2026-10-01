import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Migration 0004 turns the old "## "-sectioned bodies into product_fields values. Applies the
 * SQL files up to 0003, inserts old-shaped rows, then applies 0004+ and checks the result.
 */

let pg: PGlite;

async function apply(files: string[]) {
  for (const f of files) {
    const sql = await readFile(`drizzle/${f}`, "utf8");
    for (const stmt of sql.split("--> statement-breakpoint")) if (stmt.trim()) await pg.exec(stmt);
  }
}

beforeAll(async () => {
  pg = new PGlite();
  const files = (await readdir("drizzle")).filter((f) => f.endsWith(".sql")).sort();
  const before = files.filter((f) => f < "0004");
  await apply(before);

  await pg.exec(`
    INSERT INTO products (code, name_mn, price, person_count, allowed_groups)
    VALUES ('birthday', 'Төрсөн өдөр', 2000, 1, '{self}'),
           ('synastry', 'Нийцэл', 1000, 2, '{self}'),
           ('sign', 'Орд', 1000, 1, '{self}');
    INSERT INTO content_entries (product_code, section, key, title, body, teaser, status) VALUES
      ('birthday', 'main', '03-21', 'Т', E'## Ерөнхий шинж\\n\\nЭхний. Хоёр.\\n\\nГурав.\\n\\n## Бясалгах үг\\n\\nАмгалан.\\n\\n## Зөвлөгөө\\n\\n• Нэг\\n• Хоёр\\n\\n## Нууц хэсэг\\n\\nНэмэлт.',
        E'Давуу тал: Түшигтэй · Тачаангуй\\nСул тал: Зөрүүд', 'published'),
      ('synastry', 'period_pair', '1|2', 'Х', E'Танилцуулга.\\n\\n## Давуу тал\\n\\n• А\\n• Б\\n\\n## Тохиромжтой харилцаа\\n\\nГэрлэлт, Найз', NULL, 'published'),
      ('sign', 'main', 'leo', 'А', 'Энгийн текст.', 'Тизер', 'draft'),
      ('synastry', 'sign_pair', 'aries|leo', '[Placeholder] Нийцэл — aries|leo', 'Текст.', NULL, 'published'),
      ('synastry', 'sign_pair', 'cancer|leo', 'Жинхэнэ', 'Текст.', NULL, 'published'),
      ('synastry', 'sign_pair', 'leo|leo', '[Placeholder] Нийцэл — leo|leo', 'Текст.', NULL, 'published');
  `);
  await apply(files.filter((f) => f >= "0004"));
});
afterAll(() => pg.close());

const fieldsOf = async (key: string) =>
  (
    await pg.query<{ fields: Record<string, string>; teaser: string | null }>(
      "SELECT fields, teaser FROM content_entries WHERE key = $1",
      [key],
    )
  ).rows[0];

describe("migration 0004 (body → fields)", () => {
  it("creates parts and fields only for the existing products", async () => {
    const parts = await pg.query<{ product_code: string; code: string }>(
      "SELECT product_code, code FROM product_parts ORDER BY product_code, sort",
    );
    expect(parts.rows.map((r) => `${r.product_code}.${r.code}`)).toEqual([
      "birthday.main",
      "sign.main",
      "synastry.sign_pair",
      "synastry.period_pair",
    ]);
    const icon = await pg.query<{ icon: string }>(
      "SELECT icon FROM products WHERE code = 'birthday'",
    );
    expect(icon.rows[0].icon).toBe("calendar");
  });

  it("splits a birthday body by heading and its teaser into the free lists", async () => {
    const row = await fieldsOf("03-21");
    expect(row.fields).toEqual({
      general: "Эхний. Хоёр.\n\nГурав.\n\n## Нууц хэсэг\n\nНэмэлт.",
      meditation: "Амгалан.",
      advice: "• Нэг\n• Хоёр",
      strengths: "Түшигтэй\nТачаангуй",
      weaknesses: "Зөрүүд",
    });
    expect(row.teaser).toBeNull();
  });

  it("puts the prose before the first heading into general", async () => {
    expect((await fieldsOf("1|2")).fields).toEqual({
      general: "Танилцуулга.",
      strengths: "• А\n• Б",
      good_for: "Гэрлэлт, Найз",
    });
  });

  it("keeps a plain body and a non-birthday teaser", async () => {
    const row = await fieldsOf("leo");
    expect(row.fields).toEqual({ general: "Энгийн текст." });
    expect(row.teaser).toBe("Тизер");
  });
});

describe("migration 0008 (ordered sign pairs)", () => {
  it("re-keys synastry's sign pair and adds the reverse placeholders only", async () => {
    const part = await pg.query<{ key_type: string }>(
      "SELECT key_type FROM product_parts WHERE product_code = 'synastry' AND code = 'sign_pair'",
    );
    expect(part.rows[0].key_type).toBe("sign_pair_ordered");
    const rows = await pg.query<{ key: string; title: string }>(
      "SELECT key, title FROM content_entries WHERE section = 'sign_pair' ORDER BY key",
    );
    expect(rows.rows).toEqual([
      { key: "aries|leo", title: "[Placeholder] Нийцэл — aries|leo" },
      { key: "cancer|leo", title: "Жинхэнэ" },
      { key: "leo|aries", title: "[Placeholder] Нийцэл — leo|aries" },
      { key: "leo|leo", title: "[Placeholder] Нийцэл — leo|leo" },
    ]);
  });
});
