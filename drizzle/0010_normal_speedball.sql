CREATE TABLE "site_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"site_user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"csrf_token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "site_users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"email" text NOT NULL,
	"normalized_email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_users_project_email_unique" UNIQUE("project_id","normalized_email")
);
--> statement-breakpoint
ALTER TABLE "application_records" ADD COLUMN "site_user_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "public_intake" jsonb;--> statement-breakpoint
ALTER TABLE "site_sessions" ADD CONSTRAINT "site_sessions_site_user_id_site_users_id_fk" FOREIGN KEY ("site_user_id") REFERENCES "public"."site_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_sessions" ADD CONSTRAINT "site_sessions_project_tenant_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_users" ADD CONSTRAINT "site_users_project_tenant_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_sessions_user_idx" ON "site_sessions" USING btree ("site_user_id","expires_at");--> statement-breakpoint
CREATE INDEX "site_users_project_idx" ON "site_users" USING btree ("project_id","created_at");--> statement-breakpoint
ALTER TABLE "application_records" ADD CONSTRAINT "application_records_site_user_id_site_users_id_fk" FOREIGN KEY ("site_user_id") REFERENCES "public"."site_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_records_site_user_idx" ON "application_records" USING btree ("site_user_id","created_at");