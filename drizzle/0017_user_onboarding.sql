ALTER TABLE "user" ADD COLUMN "onboarding" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
-- People who already use the app (they have someone besides themselves) skip the first-run guide.
UPDATE "user" u SET "onboarding" = jsonb_build_object('dismissed', now())
WHERE EXISTS (
  SELECT 1 FROM "persons" p
  WHERE p."owner_user_id" = u."id" AND NOT p."is_self" AND p."deleted_at" IS NULL
);
