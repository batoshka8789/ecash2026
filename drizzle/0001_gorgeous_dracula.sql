ALTER TABLE "franchise_leads" ADD COLUMN "funds" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "franchise_leads" ADD COLUMN "experience" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "franchise_leads" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;