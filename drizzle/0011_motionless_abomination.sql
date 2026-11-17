CREATE TABLE "application_attachments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"record_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_attachments_record_asset_unique" UNIQUE("record_id","asset_id")
);
--> statement-breakpoint
ALTER TABLE "application_attachments" ADD CONSTRAINT "application_attachments_record_id_application_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."application_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_attachments" ADD CONSTRAINT "application_attachments_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_attachments" ADD CONSTRAINT "application_attachments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_attachments" ADD CONSTRAINT "application_attachments_project_tenant_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_attachments_record_idx" ON "application_attachments" USING btree ("project_id","object_key","record_id","created_at");