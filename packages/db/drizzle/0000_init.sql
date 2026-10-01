CREATE TABLE IF NOT EXISTS "organizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "name" text NOT NULL,
  "key_prefix" text NOT NULL,
  "key_hash" text NOT NULL,
  "environment" text DEFAULT 'live' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_used_at" timestamp with time zone,
  "revoked_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "agents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "agent_key" text NOT NULL,
  "display_name" text,
  "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "model_pricing" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "input_price_per_million" numeric(18, 8) NOT NULL,
  "output_price_per_million" numeric(18, 8) NOT NULL,
  "currency" text DEFAULT 'USD' NOT NULL,
  "effective_from" timestamp with time zone NOT NULL,
  "effective_to" timestamp with time zone,
  "source" text DEFAULT 'seed' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "traces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" text NOT NULL,
  "trace_id" text NOT NULL,
  "project_id" uuid NOT NULL,
  "agent_id" uuid NOT NULL,
  "environment" text,
  "provider" text,
  "model" text,
  "operation_name" text,
  "started_at" timestamp with time zone NOT NULL,
  "ended_at" timestamp with time zone NOT NULL,
  "latency_ms" integer NOT NULL,
  "status" text NOT NULL,
  "input_tokens" integer,
  "output_tokens" integer,
  "total_tokens" integer,
  "error_name" text,
  "error_message" text,
  "error_code" text,
  "metadata" jsonb,
  "tags" jsonb,
  "sdk_name" text NOT NULL,
  "sdk_version" text NOT NULL,
  "input_cost" numeric(18, 10),
  "output_cost" numeric(18, 10),
  "total_cost" numeric(18, 10),
  "currency" text,
  "cost_status" text DEFAULT 'pending' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk"
 FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
 ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_organizations_id_fk"
 FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
 ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_project_id_projects_id_fk"
 FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
 ALTER TABLE "agents" ADD CONSTRAINT "agents_project_id_projects_id_fk"
 FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
 ALTER TABLE "traces" ADD CONSTRAINT "traces_project_id_projects_id_fk"
 FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
 ALTER TABLE "traces" ADD CONSTRAINT "traces_agent_id_agents_id_fk"
 FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "projects_org_slug_uidx" ON "projects" USING btree ("organization_id","slug");
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_hash_uidx" ON "api_keys" USING btree ("key_hash");
CREATE INDEX IF NOT EXISTS "api_keys_prefix_idx" ON "api_keys" USING btree ("key_prefix");
CREATE UNIQUE INDEX IF NOT EXISTS "agents_project_key_uidx" ON "agents" USING btree ("project_id","agent_key");
CREATE INDEX IF NOT EXISTS "model_pricing_lookup_idx" ON "model_pricing" USING btree ("provider","model","effective_from");
CREATE UNIQUE INDEX IF NOT EXISTS "traces_event_id_uidx" ON "traces" USING btree ("event_id");
CREATE INDEX IF NOT EXISTS "traces_project_started_idx" ON "traces" USING btree ("project_id","started_at");
CREATE INDEX IF NOT EXISTS "traces_project_agent_idx" ON "traces" USING btree ("project_id","agent_id");
CREATE INDEX IF NOT EXISTS "traces_cost_status_idx" ON "traces" USING btree ("cost_status");
