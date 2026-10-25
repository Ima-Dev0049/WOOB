CREATE TABLE "project_creation_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"request_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"generation_id" uuid,
	"project_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "project_creation_requests" ADD CONSTRAINT "project_creation_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_creation_requests" ADD CONSTRAINT "project_creation_requests_project_tenant_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_creation_requests_key_unique" ON "project_creation_requests" USING btree ("workspace_id","requested_by","request_key");