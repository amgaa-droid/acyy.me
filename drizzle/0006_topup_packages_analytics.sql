CREATE TABLE "preview_views" (
	"user_id" uuid NOT NULL,
	"product_code" text NOT NULL,
	"subject_key" text NOT NULL,
	"view_count" integer DEFAULT 1 NOT NULL,
	"first_viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "preview_views_user_id_product_code_subject_key_pk" PRIMARY KEY("user_id","product_code","subject_key")
);
--> statement-breakpoint
CREATE TABLE "topup_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"amount" bigint NOT NULL,
	"bonus" bigint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topup_packages_amount_unique" UNIQUE("amount"),
	CONSTRAINT "topup_packages_amount_pos" CHECK ("topup_packages"."amount" > 0),
	CONSTRAINT "topup_packages_bonus_nonneg" CHECK ("topup_packages"."bonus" >= 0)
);
--> statement-breakpoint
ALTER TABLE "topups" ADD COLUMN "package_id" uuid;--> statement-breakpoint
ALTER TABLE "preview_views" ADD CONSTRAINT "preview_views_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preview_views" ADD CONSTRAINT "preview_views_product_code_products_code_fk" FOREIGN KEY ("product_code") REFERENCES "public"."products"("code") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "preview_views_first_viewed_idx" ON "preview_views" USING btree ("first_viewed_at");--> statement-breakpoint
ALTER TABLE "topups" ADD CONSTRAINT "topups_package_id_topup_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."topup_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchases_created_idx" ON "purchases" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "topups_paid_at_idx" ON "topups" USING btree ("paid_at");--> statement-breakpoint
INSERT INTO "topup_packages" ("amount", "bonus", "sort") VALUES (2000, 0, 1), (5000, 300, 2), (10000, 1000, 3), (20000, 3000, 4) ON CONFLICT ("amount") DO NOTHING;--> statement-breakpoint
UPDATE "topups" SET "package_id" = p."id" FROM "topup_packages" p WHERE "topups"."package_id" IS NULL AND p."amount" = "topups"."amount";
