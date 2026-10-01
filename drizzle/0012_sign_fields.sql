-- Sign reading gets two more sub-sections after "general" (Ерөнхий): strengths and weaknesses.
INSERT INTO "product_fields" ("product_code", "part_code", "code", "name_mn", "kind", "is_free", "required", "sort")
SELECT pp.product_code, pp.code, f.code, f.name_mn, 'text', false, false, f.sort
FROM "product_parts" pp
CROSS JOIN (VALUES
  ('strengths', 'Давуу тал', 2),
  ('weaknesses', 'Сул тал', 3)
) AS f(code, name_mn, sort)
WHERE pp.product_code = 'sign' AND pp.code = 'main'
ON CONFLICT ("product_code", "part_code", "code") DO NOTHING;
