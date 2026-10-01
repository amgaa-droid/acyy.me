-- Love reading gets five sub-sections. "general" keeps its code (stored texts stay valid) and
-- becomes the first one; the other four are added after it.
UPDATE "product_fields" SET "name_mn" = 'Хайр сэтгэлийн зан төлөв'
WHERE "product_code" = 'love' AND "part_code" = 'main' AND "code" = 'general' AND "name_mn" = 'Ерөнхий';--> statement-breakpoint
INSERT INTO "product_fields" ("product_code", "part_code", "code", "name_mn", "kind", "is_free", "required", "sort")
SELECT pp.product_code, pp.code, f.code, f.name_mn, 'text', false, false, f.sort
FROM "product_parts" pp
CROSS JOIN (VALUES
  ('first_impression', 'Анхны сэтгэгдэл', 2),
  ('attraction', 'Сэтгэл татах арга барил', 3),
  ('dating_style', 'Болзооны хэв маяг', 4),
  ('relationship', 'Харилцаанд хандах нь', 5)
) AS f(code, name_mn, sort)
WHERE pp.product_code = 'love' AND pp.code = 'main'
ON CONFLICT ("product_code", "part_code", "code") DO NOTHING;
