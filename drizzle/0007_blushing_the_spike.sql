ALTER TABLE "ai_generations" ADD COLUMN "page_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_generations" ADD COLUMN "request_key" text;--> statement-breakpoint
ALTER TABLE "ai_generations" ADD COLUMN "request_hash" text;--> statement-breakpoint
ALTER TABLE "ai_generations" ADD COLUMN "selected_node_id" text;--> statement-breakpoint
ALTER TABLE "ai_generations" ADD COLUMN "base_revision" integer;--> statement-breakpoint
ALTER TABLE "ai_generations" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_generations" ADD COLUMN "lease_expires_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_generations_request_key_unique" ON "ai_generations" USING btree ("workspace_id","requested_by","request_key");