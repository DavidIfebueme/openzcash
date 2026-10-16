CREATE TABLE "ecosystem_public_snapshots" (
  "registry_hash" text PRIMARY KEY NOT NULL,
  "checkpoint" jsonb NOT NULL,
  "collected_at" timestamp with time zone,
  "snapshot" jsonb,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
