ALTER TABLE "incidents" DROP CONSTRAINT "incidents_content_type_check";--> statement-breakpoint
ALTER TABLE "incidents" ALTER COLUMN "storage_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "incidents" ALTER COLUMN "content_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_content_type_check" CHECK ("incidents"."content_type" in ('image/webp', 'image/png', 'image/jpeg'));