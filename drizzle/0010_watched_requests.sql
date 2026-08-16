CREATE TABLE "watched_requests" (
	"request_id" integer PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"status" integer NOT NULL,
	"needs_confirm" boolean DEFAULT false NOT NULL,
	"is_individual" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
