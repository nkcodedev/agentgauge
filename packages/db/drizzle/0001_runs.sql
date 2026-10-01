CREATE TABLE IF NOT EXISTS "runs" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" uuid NOT NULL,
  "agent_id" uuid NOT NULL,
  "name" text NOT NULL,
  "status" text DEFAULT 'running' NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "ended_at" timestamp with time zone,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "runs_project_started_idx" ON "runs" USING btree ("project_id","started_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "runs_project_agent_idx" ON "runs" USING btree ("project_id","agent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "runs_project_status_idx" ON "runs" USING btree ("project_id","status");
--> statement-breakpoint
ALTER TABLE "traces" ADD COLUMN IF NOT EXISTS "run_id" text;
--> statement-breakpoint
ALTER TABLE "traces" ADD COLUMN IF NOT EXISTS "operation_id" text;
--> statement-breakpoint
ALTER TABLE "traces" ADD COLUMN IF NOT EXISTS "attempt" integer;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "traces" ADD CONSTRAINT "traces_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "traces_run_id_idx" ON "traces" USING btree ("run_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "traces_run_started_idx" ON "traces" USING btree ("run_id","started_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "traces_run_operation_idx" ON "traces" USING btree ("run_id","operation_id");
