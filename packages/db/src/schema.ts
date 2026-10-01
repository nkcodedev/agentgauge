import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("projects_org_slug_uidx").on(t.organizationId, t.slug)],
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    environment: text("environment").notNull().default("live"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("api_keys_hash_uidx").on(t.keyHash),
    index("api_keys_prefix_idx").on(t.keyPrefix),
  ],
);

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    agentKey: text("agent_key").notNull(),
    displayName: text("display_name"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("agents_project_key_uidx").on(t.projectId, t.agentKey)],
);

export const modelPricing = pgTable(
  "model_pricing",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    inputPricePerMillion: numeric("input_price_per_million", {
      precision: 18,
      scale: 8,
    }).notNull(),
    outputPricePerMillion: numeric("output_price_per_million", {
      precision: 18,
      scale: 8,
    }).notNull(),
    currency: text("currency").notNull().default("USD"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    source: text("source").notNull().default("seed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("model_pricing_lookup_idx").on(t.provider, t.model, t.effectiveFrom)],
);

export const traces = pgTable(
  "traces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: text("event_id").notNull(),
    traceId: text("trace_id").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    environment: text("environment"),
    provider: text("provider"),
    model: text("model"),
    operationName: text("operation_name"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
    latencyMs: integer("latency_ms").notNull(),
    status: text("status").notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    totalTokens: integer("total_tokens"),
    errorName: text("error_name"),
    errorMessage: text("error_message"),
    errorCode: text("error_code"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    tags: jsonb("tags").$type<string[]>(),
    sdkName: text("sdk_name").notNull(),
    sdkVersion: text("sdk_version").notNull(),
    inputCost: numeric("input_cost", { precision: 18, scale: 10 }),
    outputCost: numeric("output_cost", { precision: 18, scale: 10 }),
    totalCost: numeric("total_cost", { precision: 18, scale: 10 }),
    currency: text("currency"),
    costStatus: text("cost_status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("traces_event_id_uidx").on(t.eventId),
    index("traces_project_started_idx").on(t.projectId, t.startedAt),
    index("traces_project_agent_idx").on(t.projectId, t.agentId),
    index("traces_cost_status_idx").on(t.costStatus),
  ],
);

export type Organization = typeof organizations.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type Trace = typeof traces.$inferSelect;
export type ModelPricing = typeof modelPricing.$inferSelect;
