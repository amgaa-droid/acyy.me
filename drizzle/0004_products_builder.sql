CREATE TABLE "product_fields" (
	"product_code" text NOT NULL,
	"part_code" text NOT NULL,
	"code" text NOT NULL,
	"name_mn" text NOT NULL,
	"kind" text NOT NULL,
	"is_free" boolean DEFAULT false NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "product_fields_product_code_part_code_code_pk" PRIMARY KEY("product_code","part_code","code"),
	CONSTRAINT "product_fields_kind" CHECK (kind IN ('text', 'quote', 'cards', 'list', 'chips', 'alert'))
);
--> statement-breakpoint
CREATE TABLE "product_parts" (
	"product_code" text NOT NULL,
	"code" text NOT NULL,
	"name_mn" text NOT NULL,
	"key_type" text NOT NULL,
	"by_gender" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "product_parts_product_code_code_pk" PRIMARY KEY("product_code","code"),
	CONSTRAINT "product_parts_key_type" CHECK (key_type IN ('month_day', 'sign', 'period', 'sign_pair', 'period_pair', 'sign_pair_ordered'))
);
--> statement-breakpoint
ALTER TABLE "content_entries" DROP CONSTRAINT "content_entries_section";--> statement-breakpoint
ALTER TABLE "content_entries" ALTER COLUMN "body" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "content_entries" ADD COLUMN "fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "icon" text DEFAULT 'sparkles' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tint" text DEFAULT 'tint-1' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "product_fields" ADD CONSTRAINT "product_fields_product_code_part_code_product_parts_product_code_code_fk" FOREIGN KEY ("product_code","part_code") REFERENCES "public"."product_parts"("product_code","code") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_parts" ADD CONSTRAINT "product_parts_product_code_products_code_fk" FOREIGN KEY ("product_code") REFERENCES "public"."products"("code") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
-- Data: the launch products get their icons, parts and sub-sections (= src/server/db/seed-data.ts).
-- A fresh database has no products yet; `pnpm db:seed` inserts the same rows there.
UPDATE "products" SET "icon" = v.icon, "tint" = v.tint
FROM (VALUES
  ('birthday', 'calendar', 'highlight'),
  ('sign', 'sparkles', 'tint-1'),
  ('love', 'heart', 'tint-2'),
  ('sex', 'flame', 'dark'),
  ('dating', 'coffee', 'tint-3'),
  ('synastry', 'blend', 'nav')
) AS v(code, icon, tint)
WHERE "products"."code" = v.code;--> statement-breakpoint
INSERT INTO "product_parts" ("product_code", "code", "name_mn", "key_type", "sort")
SELECT v.product_code, v.code, v.name_mn, v.key_type, v.sort
FROM (VALUES
  ('birthday', 'main', 'Төрсөн өдөр', 'month_day', 1),
  ('sign', 'main', 'Орд', 'sign', 1),
  ('love', 'main', 'Орд', 'sign', 1),
  ('sex', 'main', 'Орд', 'sign', 1),
  ('dating', 'main', 'Орд', 'sign', 1),
  ('synastry', 'sign_pair', 'Ордны нийцэл', 'sign_pair', 1),
  ('synastry', 'period_pair', 'Төрсөн үеийн нийцэл', 'period_pair', 2)
) AS v(product_code, code, name_mn, key_type, sort)
JOIN "products" p ON p.code = v.product_code;--> statement-breakpoint
INSERT INTO "product_fields" ("product_code", "part_code", "code", "name_mn", "kind", "is_free", "required", "sort")
SELECT v.product_code, v.part_code, v.code, v.name_mn, v.kind, v.is_free, v.required, v.sort
FROM (VALUES
  ('birthday', 'main', 'strengths', 'Давуу тал', 'list', true, false, 1),
  ('birthday', 'main', 'weaknesses', 'Сул тал', 'list', true, false, 2),
  ('birthday', 'main', 'general', 'Ерөнхий шинж', 'text', false, true, 3),
  ('birthday', 'main', 'meditation', 'Бясалгах үг', 'quote', false, false, 4),
  ('birthday', 'main', 'advice', 'Зөвлөгөө', 'cards', false, false, 5),
  ('birthday', 'main', 'health', 'Эрүүл мэнд', 'text', false, false, 6),
  ('birthday', 'main', 'numerology', 'Тоон хэлээр', 'text', false, false, 7),
  ('birthday', 'main', 'tarot', 'Таро хөзөр', 'text', false, false, 8),
  ('sign', 'main', 'general', 'Ерөнхий', 'text', false, true, 1),
  ('love', 'main', 'general', 'Ерөнхий', 'text', false, true, 1),
  ('sex', 'main', 'general', 'Ерөнхий', 'text', false, true, 1),
  ('dating', 'main', 'general', 'Ерөнхий', 'text', false, true, 1),
  ('synastry', 'sign_pair', 'general', 'Ерөнхий', 'text', false, true, 1),
  ('synastry', 'period_pair', 'general', 'Ерөнхий', 'text', false, true, 1),
  ('synastry', 'period_pair', 'strengths', 'Давуу тал', 'list', false, false, 2),
  ('synastry', 'period_pair', 'weaknesses', 'Сул тал', 'list', false, false, 3),
  ('synastry', 'period_pair', 'good_for', 'Тохиромжтой харилцаа', 'chips', false, false, 4),
  ('synastry', 'period_pair', 'caution_for', 'Анхаарах харилцаа', 'alert', false, false, 5)
) AS v(product_code, part_code, code, name_mn, kind, is_free, required, sort)
JOIN "product_parts" pp ON pp.product_code = v.product_code AND pp.code = v.part_code;--> statement-breakpoint
-- Data: body "## Heading" sections → fields by heading name; text before the first heading, and
-- headings that match no field (kept as "## " sub-headings), go to "general".
WITH chunks AS (
  SELECT ce.id, ce.product_code, ce.section, t.ord, t.chunk
  FROM "content_entries" ce,
    regexp_split_to_table(E'\n' || replace(ce.body, E'\r', ''), E'\n##[ \t]+') WITH ORDINALITY AS t(chunk, ord)
  WHERE ce.body IS NOT NULL
), parsed AS (
  SELECT id, product_code, section, ord,
    CASE WHEN ord = 1 THEN NULL ELSE btrim(split_part(chunk, E'\n', 1)) END AS heading,
    btrim(
      CASE WHEN ord = 1 THEN chunk ELSE substr(chunk, length(split_part(chunk, E'\n', 1)) + 1) END,
      E' \n\t'
    ) AS txt
  FROM chunks
), mapped AS (
  SELECT p.id, p.ord, COALESCE(f.code, 'general') AS code,
    CASE WHEN f.code IS NULL AND p.heading IS NOT NULL
      THEN '## ' || p.heading || E'\n\n' || p.txt ELSE p.txt END AS txt
  FROM parsed p
  LEFT JOIN "product_fields" f
    ON f.product_code = p.product_code AND f.part_code = p.section AND f.name_mn = p.heading
  WHERE p.txt <> ''
), grouped AS (
  SELECT id, code, string_agg(txt, E'\n\n' ORDER BY ord) AS txt FROM mapped GROUP BY id, code
)
UPDATE "content_entries" ce SET "fields" = g.obj
FROM (SELECT id, jsonb_object_agg(code, txt) AS obj FROM grouped GROUP BY id) g
WHERE ce.id = g.id;--> statement-breakpoint
-- Data: birthday teaser "Давуу тал: a · b\nСул тал: x · y" → the free strengths/weaknesses lists.
UPDATE "content_entries" ce SET
  "fields" = ce.fields
    || CASE WHEN s.strengths <> '' THEN jsonb_build_object('strengths', s.strengths) ELSE '{}'::jsonb END
    || CASE WHEN s.weaknesses <> '' THEN jsonb_build_object('weaknesses', s.weaknesses) ELSE '{}'::jsonb END,
  "teaser" = NULL
FROM (
  SELECT id,
    btrim(replace(coalesce(substring(teaser from 'Давуу тал:([^\n]*)'), ''), ' · ', E'\n')) AS strengths,
    btrim(replace(coalesce(substring(teaser from 'Сул тал:([^\n]*)'), ''), ' · ', E'\n')) AS weaknesses
  FROM "content_entries"
  WHERE product_code = 'birthday' AND section = 'main' AND teaser IS NOT NULL
) s
WHERE ce.id = s.id AND (s.strengths <> '' OR s.weaknesses <> '');--> statement-breakpoint
ALTER TABLE "content_entries" ADD CONSTRAINT "content_entries_part_fk" FOREIGN KEY ("product_code","section") REFERENCES "public"."product_parts"("product_code","code") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_icon" CHECK (icon IN ('calendar', 'sparkles', 'heart', 'flame', 'coffee', 'blend', 'moon', 'sun', 'star', 'gem', 'baby', 'briefcase', 'leaf', 'users'));--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tint" CHECK (tint IN ('highlight', 'tint-1', 'tint-2', 'tint-3', 'dark', 'nav'));