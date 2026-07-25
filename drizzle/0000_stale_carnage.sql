CREATE TABLE "competitors" (
	"id" text PRIMARY KEY NOT NULL,
	"name_key" text NOT NULL,
	"color" text NOT NULL,
	"buy" numeric(14, 4) NOT NULL,
	"sell" numeric(14, 4) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"account_id" text NOT NULL,
	"currency_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_account_id_currency_code_pk" PRIMARY KEY("account_id","currency_code")
);
--> statement-breakpoint
CREATE TABLE "franchise_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"image" text NOT NULL,
	"key" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "news_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"account_id" text PRIMARY KEY NOT NULL,
	"avatar" text,
	"about" text DEFAULT '' NOT NULL,
	"occupation" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"currency_from" text NOT NULL,
	"currency_to" text NOT NULL,
	"target_rate" numeric(14, 4) NOT NULL,
	"until" timestamp with time zone NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"fired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dep_id" integer NOT NULL,
	"currency_code" text NOT NULL,
	"buy" numeric(14, 4) NOT NULL,
	"sell" numeric(14, 4) NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "rate_alerts_account_idx" ON "rate_alerts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "rate_snapshots_lookup_idx" ON "rate_snapshots" USING btree ("dep_id","currency_code","taken_at");