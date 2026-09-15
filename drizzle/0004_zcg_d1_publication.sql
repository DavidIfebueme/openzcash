CREATE TABLE "zcg_publications" (
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"published" jsonb,
	"pending" jsonb,
	"observed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "zcg_publications_scope_key_pk" PRIMARY KEY("scope","key")
);
--> statement-breakpoint
ALTER TABLE "zcg_changelog" ADD COLUMN "entity_key" text;