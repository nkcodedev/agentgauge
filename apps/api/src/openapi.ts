export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "AgentGauge API",
    version: "0.5.0",
    description:
      "Telemetry ingestion, usage query, API-key management, and live SSE updates for AgentGauge.",
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
    "/v1/events/stream": {
      get: {
        summary: "Project-scoped Server-Sent Events stream",
        description:
          "Long-lived SSE connection. Emits `ready` then `trace.created` for newly persisted traces. Heartbeat comments every ~20s. Does not include prompts/completions or API keys. In-memory fan-out is single-process only.",
        responses: {
          "200": { description: "text/event-stream" },
          "401": { description: "Unauthorized" },
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
