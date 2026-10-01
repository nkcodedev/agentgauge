# AgentGauge Telemetry Spec (V1)

**Status:** Implemented through `@agentgauge/openai` `0.2.0` for OpenAI adapters; schema remains provider-neutral
**Version:** Telemetry schema V1
**Related:** [ARCHITECTURE.md](./ARCHITECTURE.md), [SECURITY.md](../SECURITY.md), [API.md](./API.md)

This document defines the **`TraceEvent`** contract. V1 is intentionally simple and extensible.

---

## Design Goals

- Capture agent operational telemetry: identity, provider, model, tokens, latency, status, context
- Remain provider-neutral at the contract layer
- Support privacy-first defaults
- Allow additive optional fields without breaking older SDKs
- Stay small enough to batch efficiently over HTTP

---

## TraceEvent Overview

A `TraceEvent` represents a single observed agent operation (for example, one manually closed trace).

V1 treats each event as a **single logical operation**. Parent/child spans, tool graphs, and cross-service correlation are future extensions.

---

## Canonical TypeScript shape (0.1.0)

```ts
interface TraceEvent {
  eventId: string;
  traceId: string;
  agentId: string;

  project?: string;
  environment?: string;

  provider?: string;
  model?: string;
  operationName?: string;

  startedAt: string; // ISO-8601 UTC, e.g. 2026-10-01T10:30:45.123Z
  endedAt: string;

  latencyMs: number;
  status: "success" | "error";

  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };

  error?: {
    name?: string;
    message?: string;
    code?: string;
  };

  metadata?: Record<string, unknown>;
  tags?: string[];

  sdk: {
    name: string;
    version: string;
  };
}
```

### Field notes

| Field | Required | Source | Notes |
|-------|----------|--------|-------|
| `eventId` | yes | auto (`crypto.randomUUID()`) | Unique per event |
| `traceId` | yes | auto (defaults to `eventId`) or user | Opaque correlation id |
| `agentId` | yes | user | Non-empty after trim |
| `project` | optional (SDK) | config / user | Recommended; may be required by cloud ingest later |
| `environment` | optional (SDK) | config / user | Recommended; may be required by cloud ingest later |
| `provider` / `model` | optional | user / future adapters | Optional for manual traces |
| `operationName` | optional | user / adapter | |
| `startedAt` / `endedAt` | yes | auto | ISO-8601 UTC strings |
| `latencyMs` | yes | auto | Derived via `process.hrtime.bigint()`; never negative |
| `status` | yes | auto | `"success"` \| `"error"` |
| `usage.*` | optional | user / provider | Non-negative integers; `totalTokens` derived when both parts exist and total omitted |
| `error` | optional | auto on fail | Sanitized; no stacks/secrets/prompts |
| `metadata` / `tags` | optional | user | Frozen copies; empty tags → omitted |
| `sdk` | yes | auto | e.g. `{ name: "@agentgauge/node", version: "0.1.0" }` |

### Cost fields

Estimated cost is **not** a client-populated field in V1. Authoritative estimates belong on the server.

---

## Status & Error Semantics

```text
status: "success" | "error"
```

When `status` is `error`, include sanitized `error.name` / `error.message` (and optional `code`) when available.

---

## Identifiers

- V1 uses `crypto.randomUUID()` (UUID v4)
- No external UUID dependency
- `traceId` defaults to `eventId` when not supplied

---

## Batching Envelope (Ingestion)

HTTP transport posts:

```json
{
  "events": [ { "...TraceEvent": "..." } ]
}
```

---

## Privacy Considerations

**Do not include by default:** prompts, completions, messages arrays, response bodies, API keys, Authorization headers.

The SDK rejects metadata keys: `prompt`, `completion`, `messages`, `responseBody`, `response_body`.

**Console transport** may print user-supplied metadata/tags — development only.

---

## Extensibility Rules

1. Add optional fields additively
2. Nested complexity (spans, tool trees) requires a new telemetry version or ADR
3. Provider-specific detail should not pollute core unless universal

---

## Example

```json
{
  "eventId": "5c6fe0d1-6005-47f4-b847-4d02b0e03f1b",
  "traceId": "5c6fe0d1-6005-47f4-b847-4d02b0e03f1b",
  "agentId": "support-agent",
  "project": "manual-example",
  "environment": "development",
  "provider": "openai",
  "model": "gpt-5",
  "operationName": "answer-customer",
  "startedAt": "2026-10-01T10:30:45.123Z",
  "endedAt": "2026-10-01T10:30:46.273Z",
  "latencyMs": 1150,
  "status": "success",
  "usage": {
    "inputTokens": 1200,
    "outputTokens": 320,
    "totalTokens": 1520
  },
  "metadata": { "region": "us-east-1" },
  "tags": ["tier:pro"],
  "sdk": {
    "name": "@agentgauge/node",
    "version": "0.1.0"
  }
}
```
