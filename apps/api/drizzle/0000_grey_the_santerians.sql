CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"note" text,
	"url" text,
	"user_id" text,
	"user_name" text,
	"user_email" text,
	"identity_purge_at" timestamp with time zone NOT NULL,
	"artifact_purge_at" timestamp with time zone NOT NULL,
	"storage_key" text NOT NULL,
	"content_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "incidents_type_check" CHECK ("incidents"."type" in ('bug', 'feedback')),
	CONSTRAINT "incidents_content_type_check" CHECK ("incidents"."content_type" in ('image/webp', 'image/png')),
	CONSTRAINT "incidents_status_check" CHECK ("incidents"."status" in ('pending', 'in_progress', 'resolved'))
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"public_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_public_key_unique" UNIQUE("public_key")
);
--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "incidents_project_idempotency_unique" ON "incidents" USING btree ("project_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "incidents_project_created_idx" ON "incidents" USING btree ("project_id","created_at");