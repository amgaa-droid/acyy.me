-- Synastry's sign pair becomes 144 ordered texts (A→B); one purchase still covers the pair and
-- the reading shows both directions. Existing "a|b" keys stay valid as the a→b text.
UPDATE "product_parts" SET "key_type" = 'sign_pair_ordered'
WHERE "product_code" = 'synastry' AND "code" = 'sign_pair' AND "key_type" = 'sign_pair';--> statement-breakpoint
-- The other direction of each seeded placeholder (real texts are written by the editors).
INSERT INTO "content_entries" ("product_code", "section", "key", "title", "fields", "teaser", "score", "status")
SELECT ce.product_code, ce.section,
  split_part(ce.key, '|', 2) || '|' || split_part(ce.key, '|', 1),
  replace(ce.title, ce.key, split_part(ce.key, '|', 2) || '|' || split_part(ce.key, '|', 1)),
  ce.fields, ce.teaser, ce.score, ce.status
FROM "content_entries" ce
JOIN "product_parts" pp ON pp.product_code = ce.product_code AND pp.code = ce.section
WHERE pp.key_type = 'sign_pair_ordered'
  AND ce.product_code = 'synastry' AND ce.section = 'sign_pair'
  AND ce.title LIKE '[Placeholder]%'
  AND split_part(ce.key, '|', 1) <> split_part(ce.key, '|', 2)
ON CONFLICT ("product_code", "section", "key") DO NOTHING;
