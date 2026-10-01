export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "AgentGauge API",
    version: "0.7.0",
    description:
      "Telemetry ingestion, usage query, API-key management, model pricing, and live SSE updates for AgentGauge.",
  },
  servers: [{ url: "http://localhost:3000" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description: "AgentGauge API key (ag_live_... or ag_test_...)",
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/health": {
      get: {
        security: [],
        summary: "Health check",
        responses: { "200": { description: "OK" } },
      },
    },
    "/v1/traces": {
      post: {
        summary: "Ingest one or more TraceEvent records",
        description:
          "Body: { events: TraceEvent[] } (max 100). Validates the entire batch first; if any event is malformed, rejects the whole batch (400). Duplicate eventIds are idempotent (202). Newly persisted traces emit project-scoped SSE `trace.created` events.",
        responses: {
          "202": { description: "Accepted (including idempotent duplicates)" },
          "400": { description: "Validation error" },
          "401": { description: "Unauthorized" },
          "429": { description: "Rate limited" },
        },
      },
      get: {
        summary: "List traces (cursor pagination)",
        parameters: [
          { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "agentId", in: "query", schema: { type: "string" } },
          { name: "runId", in: "query", schema: { type: "string" } },
          { name: "provider", in: "query", schema: { type: "string" } },
          { name: "model", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
          { name: "cursor", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Trace page" } },
      },
    },
    "/v1/traces/batch": {
      post: {
        summary: "Alias for POST /v1/traces",
        responses: {
          "202": { description: "Accepted" },
        },
      },
    },
    "/v1/runs": {
      post: {
        summary: "Create a run/task",
        responses: {
          "201": { description: "Run created; emits SSE run.created" },
          "400": { description: "Validation error" },
          "409": { description: "Run id conflict" },
        },
      },
      get: {
        summary: "List runs (cursor pagination, startedAt DESC)",
        parameters: [
          { name: "agentId", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
          { name: "cursor", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Run summaries with aggregates" } },
      },
    },
    "/v1/runs/{runId}": {
      get: {
        summary: "Get run detail with aggregates and recent traces",
        parameters: [{ name: "runId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Run detail" },
          "404": { description: "Not found" },
        },
      },
    },
    "/v1/runs/{runId}/end": {
      post: {
        summary: "End a run with an application-declared terminal status",
        responses: {
          "200": { description: "Run ended; emits SSE run.updated when status changes" },
          "404": { description: "Not found" },
          "409": { description: "Invalid terminal transition" },
        },
      },
    },
    "/v1/events/stream": {
      get: {
        summary: "Project-scoped Server-Sent Events stream",
        description:
          "Long-lived SSE connection. Emits `ready`, `trace.created`, `run.created`, and `run.updated`. Heartbeat comments every ~20s. Does not include prompts/completions or API keys. In-memory fan-out is single-process only.",
        responses: {
          "200": { description: "text/event-stream" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/v1/model-pricing": {
      get: {
        summary: "List installation model pricing",
        description:
          "Global catalog for this self-hosted installation. Any valid project API key can read it. Filters: provider, model, q, status, source.",
        responses: { "200": { description: "Pricing rows" } },
      },
      post: {
        summary: "Add custom or override model pricing",
        description:
          "Does not modify AgentGauge seed rows. A known seeded model is stored as an override; anything else is custom. Installation-global.",
        responses: {
          "201": { description: "Pricing created" },
          "400": { description: "Validation error" },
          "409": { description: "Overlapping user pricing window" },
        },
      },
    },
    "/v1/model-pricing/{id}/supersede": {
      post: {
        summary: "Close a user pricing row and append a new effective window",
        description:
          "Preserves the previous row. AgentGauge default rows cannot be superseded; add an override instead.",
        responses: {
          "200": { description: "Closed row and created row" },
          "400": { description: "Validation error" },
          "404": { description: "Not found" },
          "409": { description: "Overlapping user pricing window" },
        },
      },
    },
    "/v1/model-pricing/{id}/reset": {
      post: {
        summary: "End an active override so AgentGauge default pricing applies again",
        description: "Does not delete the override row.",
        responses: {
          "200": { description: "Override ended" },
          "400": { description: "Not an override" },
          "404": { description: "Not found" },
        },
      },
    },
    "/v1/usage": {
      get: {
        summary: "Aggregated usage metrics",
        parameters: [
          { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
        ],
        responses: { "200": { description: "Usage aggregates" } },
      },
    },
    "/v1/agents": {
      get: {
        summary: "List agents for the project",
        responses: { "200": { description: "Agent summaries" } },
      },
    },
    "/v1/agents/{agentId}": {
      get: {
        summary: "Get one agent summary",
        parameters: [{ name: "agentId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Agent summary" },
          "404": { description: "Not found" },
        },
      },
    },
  },
} as const;
