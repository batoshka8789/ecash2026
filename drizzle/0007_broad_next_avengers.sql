CREATE TABLE "competitors" (
	"id" text PRIMARY KEY NOT NULL,
	"name_key" text NOT NULL,
	"color" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
