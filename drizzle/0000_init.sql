CREATE TYPE "public"."trust_level" AS ENUM('restricted', 'standard', 'trusted');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'moderator', 'admin');--> statement-breakpoint
CREATE TYPE "public"."attachment_kind" AS ENUM('image', 'link', 'video');--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('active', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."moderation_outcome" AS ENUM('publish', 'review', 'reject', 'approve', 'remove', 'restore', 'close');--> statement-breakpoint
CREATE TYPE "public"."moderation_source" AS ENUM('auto', 'reports', 'moderator');--> statement-breakpoint
CREATE TYPE "public"."poll_kind" AS ENUM('single', 'multiple');--> statement-breakpoint
CREATE TYPE "public"."poll_status" AS ENUM('pending_review', 'published', 'rejected', 'removed');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('spam', 'harassment', 'hate', 'sexual', 'violence', 'self_harm', 'misinformation', 'illegal', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."results_visibility" AS ENUM('always', 'after_vote', 'after_close');--> statement-breakpoint
CREATE TYPE "public"."term_action" AS ENUM('flag', 'block');--> statement-breakpoint
CREATE TYPE "public"."term_kind" AS ENUM('word', 'domain');--> statement-breakpoint
CREATE TYPE "public"."video_provider" AS ENUM('youtube', 'vimeo');--> statement-breakpoint
CREATE TYPE "public"."voter_mode" AS ENUM('signed_in', 'anonymous_allowed');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_rate_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "auth_rate_limits_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"trust_level" "trust_level" DEFAULT 'standard' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"banned_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text,
	"actor_label" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ballot_choices" (
	"ballot_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"poll_id" uuid NOT NULL,
	CONSTRAINT "ballot_choices_ballot_id_option_id_pk" PRIMARY KEY("ballot_id","option_id")
);
--> statement-breakpoint
CREATE TABLE "ballots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"user_id" text,
	"voter_key" text NOT NULL,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text,
	"storage_key" text NOT NULL,
	"mime" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"status" "media_status" DEFAULT 'active' NOT NULL,
	"moderation" jsonb NOT NULL,
	"poll_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_storageKey_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "moderation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid,
	"source" "moderation_source" NOT NULL,
	"outcome" "moderation_outcome" NOT NULL,
	"actor_id" text,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "term_kind" NOT NULL,
	"value" text NOT NULL,
	"action" "term_action" NOT NULL,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moderation_terms_value_length" CHECK (char_length("moderation_terms"."value") between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE "poll_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"kind" "attachment_kind" NOT NULL,
	"media_id" uuid,
	"url" text,
	"video_provider" "video_provider",
	"video_id" text,
	"title" text
);
--> statement-breakpoint
CREATE TABLE "poll_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"label" text NOT NULL,
	"media_id" uuid,
	"vote_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "poll_options_label_length" CHECK (char_length("poll_options"."label") between 1 and 200),
	CONSTRAINT "poll_options_vote_count_nonnegative" CHECK ("poll_options"."vote_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "polls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" text,
	"title" text NOT NULL,
	"description_md" text DEFAULT '' NOT NULL,
	"kind" "poll_kind" DEFAULT 'single' NOT NULL,
	"max_choices" smallint DEFAULT 1 NOT NULL,
	"voter_mode" "voter_mode" DEFAULT 'signed_in' NOT NULL,
	"results_visibility" "results_visibility" DEFAULT 'always' NOT NULL,
	"status" "poll_status" NOT NULL,
	"moderation_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status_note" text,
	"closes_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"ballot_count" integer DEFAULT 0 NOT NULL,
	"report_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"search" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce("title", '')), 'A') || setweight(to_tsvector('english', coalesce("description_md", '')), 'B')) STORED,
	CONSTRAINT "polls_title_length" CHECK (char_length("polls"."title") between 1 and 200),
	CONSTRAINT "polls_description_length" CHECK (char_length("polls"."description_md") <= 5000),
	CONSTRAINT "polls_max_choices_range" CHECK ("polls"."max_choices" between 1 and 10),
	CONSTRAINT "polls_counts_nonnegative" CHECK ("polls"."ballot_count" >= 0 and "polls"."report_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"reporter_id" text NOT NULL,
	"reason" "report_reason" NOT NULL,
	"details" text,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"resolved_by_id" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_details_length" CHECK (char_length("reports"."details") <= 1000)
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"data" jsonb NOT NULL,
	"updated_by_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_settings_singleton" CHECK ("site_settings"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballot_choices" ADD CONSTRAINT "ballot_choices_ballot_id_ballots_id_fk" FOREIGN KEY ("ballot_id") REFERENCES "public"."ballots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballot_choices" ADD CONSTRAINT "ballot_choices_option_id_poll_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."poll_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballot_choices" ADD CONSTRAINT "ballot_choices_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_events" ADD CONSTRAINT "moderation_events_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_events" ADD CONSTRAINT "moderation_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_terms" ADD CONSTRAINT "moderation_terms_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_attachments" ADD CONSTRAINT "poll_attachments_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_attachments" ADD CONSTRAINT "poll_attachments_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_index" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_index" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_index" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "verifications_identifier_index" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "verifications_expires_at_index" ON "verifications" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_index" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_target_type_target_id_index" ON "audit_log" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "ballot_choices_option_id_index" ON "ballot_choices" USING btree ("option_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ballots_poll_id_voter_key_index" ON "ballots" USING btree ("poll_id","voter_key");--> statement-breakpoint
CREATE INDEX "ballots_poll_id_ip_hash_index" ON "ballots" USING btree ("poll_id","ip_hash");--> statement-breakpoint
CREATE INDEX "ballots_user_id_index" ON "ballots" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "media_owner_id_created_at_index" ON "media" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "media_unattached_idx" ON "media" USING btree ("created_at") WHERE "media"."poll_id" is null;--> statement-breakpoint
CREATE INDEX "moderation_events_poll_id_created_at_index" ON "moderation_events" USING btree ("poll_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "moderation_terms_kind_value_index" ON "moderation_terms" USING btree ("kind","value");--> statement-breakpoint
CREATE UNIQUE INDEX "poll_attachments_poll_id_position_index" ON "poll_attachments" USING btree ("poll_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "poll_options_poll_id_position_index" ON "poll_options" USING btree ("poll_id","position");--> statement-breakpoint
CREATE INDEX "polls_status_published_at_index" ON "polls" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "polls_status_closes_at_index" ON "polls" USING btree ("status","closes_at");--> statement-breakpoint
CREATE INDEX "polls_author_id_created_at_index" ON "polls" USING btree ("author_id","created_at");--> statement-breakpoint
CREATE INDEX "polls_search_idx" ON "polls" USING gin ("search");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_poll_id_reporter_id_index" ON "reports" USING btree ("poll_id","reporter_id");--> statement-breakpoint
CREATE INDEX "reports_status_created_at_index" ON "reports" USING btree ("status","created_at");