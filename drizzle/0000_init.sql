CREATE TYPE "public"."content_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'unspecified');--> statement-breakpoint
CREATE TYPE "public"."invitation_channel" AS ENUM('link', 'email');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."relation" AS ENUM('self', 'mother', 'father', 'older_brother', 'older_sister', 'younger_sibling', 'child', 'partner', 'crush', 'friend', 'coworker', 'other');--> statement-breakpoint
CREATE TYPE "public"."topup_status" AS ENUM('pending', 'paid', 'expired', 'failed');--> statement-breakpoint
CREATE TYPE "public"."wallet_entry_type" AS ENUM('topup', 'bonus', 'purchase', 'refund', 'adjust');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_code" text NOT NULL,
	"section" text NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"score" integer,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_entries_product_section_key" UNIQUE("product_code","section","key"),
	CONSTRAINT "content_entries_section" CHECK (section IN ('main', 'sign_pair', 'period_pair')),
	CONSTRAINT "content_entries_score" CHECK ("content_entries"."score" IS NULL OR "content_entries"."score" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"inviter_user_id" uuid NOT NULL,
	"channel" "invitation_channel" NOT NULL,
	"email" text,
	"token_hash" text NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_by" uuid,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "periods48" (
	"no" integer PRIMARY KEY NOT NULL,
	"start_md" char(5) NOT NULL,
	"end_md" char(5) NOT NULL,
	"label" text,
	CONSTRAINT "periods48_no_range" CHECK ("periods48"."no" BETWEEN 1 AND 48)
);
--> statement-breakpoint
CREATE TABLE "persons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"is_self" boolean DEFAULT false NOT NULL,
	"relation" "relation" NOT NULL,
	"relation_label" text,
	"name" text NOT NULL,
	"gender" "gender" DEFAULT 'unspecified' NOT NULL,
	"birth_date" date NOT NULL,
	"avatar_seed" text NOT NULL,
	"linked_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "persons_self_relation" CHECK ("persons"."is_self" = ("persons"."relation" = 'self')),
	CONSTRAINT "persons_name_len" CHECK (char_length("persons"."name") BETWEEN 1 AND 40),
	CONSTRAINT "persons_relation_label_len" CHECK ("persons"."relation_label" IS NULL OR char_length("persons"."relation_label") <= 20)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"code" text PRIMARY KEY NOT NULL,
	"name_mn" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price" bigint NOT NULL,
	"person_count" integer NOT NULL,
	"allowed_groups" text[] NOT NULL,
	"adult_only" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "products_price_nonneg" CHECK ("products"."price" >= 0),
	CONSTRAINT "products_person_count" CHECK ("products"."person_count" IN (1, 2))
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_code" text NOT NULL,
	"price_paid" bigint NOT NULL,
	"person_a_id" uuid,
	"person_b_id" uuid,
	"subject_key" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchases_user_product_subject" UNIQUE("user_id","product_code","subject_key"),
	CONSTRAINT "purchases_price_nonneg" CHECK ("purchases"."price_paid" >= 0)
);
--> statement-breakpoint
CREATE TABLE "topups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"bonus" bigint DEFAULT 0 NOT NULL,
	"status" "topup_status" DEFAULT 'pending' NOT NULL,
	"provider" text NOT NULL,
	"invoice_id" text,
	"payment_id" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topups_invoiceId_unique" UNIQUE("invoice_id"),
	CONSTRAINT "topups_amount_pos" CHECK ("topups"."amount" > 0),
	CONSTRAINT "topups_bonus_nonneg" CHECK ("topups"."bonus" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"adult_confirmed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "wallet_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "wallet_entry_type" NOT NULL,
	"amount" bigint NOT NULL,
	"balance_after" bigint NOT NULL,
	"ref_type" text,
	"ref_id" text,
	"idempotency_key" text NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_entries_idempotencyKey_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "wallet_entries_amount_nonzero" CHECK ("wallet_entries"."amount" <> 0),
	CONSTRAINT "wallet_entries_balance_after_nonneg" CHECK ("wallet_entries"."balance_after" >= 0)
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"balance" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_balance_nonneg" CHECK ("wallets"."balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "zodiac_signs" (
	"code" text PRIMARY KEY NOT NULL,
	"name_mn" text NOT NULL,
	"start_md" char(5) NOT NULL,
	"end_md" char(5) NOT NULL,
	"sort" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_entries" ADD CONSTRAINT "content_entries_product_code_products_code_fk" FOREIGN KEY ("product_code") REFERENCES "public"."products"("code") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "content_entries" ADD CONSTRAINT "content_entries_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_inviter_user_id_user_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_by_user_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_linked_user_id_user_id_fk" FOREIGN KEY ("linked_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_product_code_products_code_fk" FOREIGN KEY ("product_code") REFERENCES "public"."products"("code") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_person_a_id_persons_id_fk" FOREIGN KEY ("person_a_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_person_b_id_persons_id_fk" FOREIGN KEY ("person_b_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topups" ADD CONSTRAINT "topups_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "invitations_person_idx" ON "invitations" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "persons_one_self_per_owner" ON "persons" USING btree ("owner_user_id") WHERE "persons"."is_self" AND "persons"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "persons_owner_idx" ON "persons" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "persons_linked_user_idx" ON "persons" USING btree ("linked_user_id");--> statement-breakpoint
CREATE INDEX "purchases_user_idx" ON "purchases" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "purchases_person_a_idx" ON "purchases" USING btree ("person_a_id");--> statement-breakpoint
CREATE INDEX "purchases_person_b_idx" ON "purchases" USING btree ("person_b_id");--> statement-breakpoint
CREATE INDEX "topups_user_idx" ON "topups" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "topups_status_created_idx" ON "topups" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "wallet_entries_user_created_idx" ON "wallet_entries" USING btree ("user_id","created_at");