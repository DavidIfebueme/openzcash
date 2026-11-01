CREATE TABLE "coinholder_topic_cache" (
  "input_hash" text PRIMARY KEY NOT NULL,
  "proposal_number" integer NOT NULL,
  "analysis" jsonb,
  "lease_id" text,
  "lease_until" timestamp with time zone,
  "retry_after" timestamp with time zone DEFAULT now() NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
