# AgentGauge Telemetry Spec (V1)

**Status:** Implemented through run/task observability (`0.7.0` local); schema remains provider-neutral
**Version:** Telemetry schema V1
**Related:** [ARCHITECTURE.md](./ARCHITECTURE.md), [SECURITY.md](../SECURITY.md), [API.md](./API.md)

This document defines the **`TraceEvent`** contract and the optional **Run** association. V1 is intentionally simple and extensible.

---

## Design Goals

- Capture agent operational telemetry: identity, provider, model, tokens, latency, status, context
- Remain provider-neutral at the contract layer
- Support privacy-first defaults
- Allow additive optional fields without breaking older SDKs
- Stay small enough to batch efficiently over HTTP
- Distinguish **request-level** outcomes (traces) from **task-level** outcomes (runs)

---

## TraceEvent Overview

A `TraceEvent` represents a single observed agent operation (for example, one manually closed trace).

V1 treats each event as a **single logical operation**. Parent/child spans, tool graphs, and cross-service correlation are future extensions.

Optional `runId` / `operationId` / `attempt` fields associate a trace with a higher-level run without requiring them.

---

## Canonical TypeScript shape

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

  /** Optional association with a logical run/task. Absent → standalone trace. */
  runId?: string;
  /** Optional logical operation within a run (groups retries). */
  operationId?: string;
  /** Optional 1-based retry attempt for the same operationId. */
  attempt?: number;

  startedAt: string; // ISO-8601 UTC
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
| `project` | optional (SDK) | config / user | Recommended |
| `environment` | optional (SDK) | config / user | Recommended |
| `provider` / `model` | optional | user / adapters | |
| `operationName` | optional | user / adapter | |
| `runId` | optional | user / `startRun` | Standalone traces omit this |
| `operationId` | optional | user | Groups retries of one logical action |
| `attempt` | optional | user | Integer ≥ 1 |
| `startedAt` / `endedAt` | yes | auto | ISO-8601 UTC strings |
| `latencyMs` | yes | auto | Never negative |
| `status` | yes | auto | `"success"` \| `"error"` |
| `usage.*` | optional | user / provider | Non-negative integers |
| `error` | optional | auto on fail | Sanitized; no stacks/secrets/prompts |
| `metadata` / `tags` | optional | user | Frozen copies |
| `sdk` | yes | auto | Package identity |

### Cost fields

Estimated cost is **not** a client-populated field in V1. Authoritative estimates belong on the server.

---

## Runs (task-level)

A **run** is one logical agent execution / user task containing zero or more traces.

```ts
const run = gauge.startRun({
  name: "customer-support-request",
  agentId: "support-agent",
});

try {
  const trace = gauge.startTrace({
    agentId: "support-agent",
    runId: run.id,
    operationId: "lookup_customer",
    attempt: 1,
  });
  // instrumented work...
  trace.end({ inputTokens: 100, outputTokens: 40 });

  await run.end({ status: "success" });
} catch (error) {
  await run.end({ status: "error" });
  throw error;
}
```

### Semantics

- **Final run status is application-declared** — not inferred from child traces
- A run may end `success` even if some child traces failed (retries recovered)
- A run may end `timeout` / `cancelled` / `error` even if all child traces succeeded
- `retryCount` uses `operationId` + `attempt` when present: per operation `max(attempt) - 1`
- Run duration = `endedAt - startedAt` (not the sum of child latencies)
- Partial cost: when any child has unknown pricing, APIs set `hasUnknownCost: true` alongside known `estimatedCost`

Traces without `runId` remain fully valid (request-level observability unchanged).

---

## Status & Error Semantics

```text
trace.status: "success" | "error"
run.status:   "running" | "success" | "error" | "cancelled" | "timeout"
```

---

## Identifiers

- V1 uses `crypto.randomUUID()` (UUID v4)
- `traceId` defaults to `eventId` when not supplied
- Run ids default to `run_<uuid>` when not supplied by the client

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

**Do not include by default:** prompts, completions, messages arrays, response bodies, tool payloads, reasoning text, API keys, Authorization headers.

The SDK rejects metadata keys such as: `prompt`, `completion`, `messages`, `responseBody`, `response_body`, `apiKey`.

Run `name` is developer-supplied operational data — avoid embedding sensitive user content.

**Console transport** may print user-supplied metadata/tags — development only.

---

## Extensibility Rules

1. Add optional fields additively
2. Nested complexity (spans, tool trees, multi-agent runs) requires a new telemetry version or ADR
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
  "runId": "run_abc123",
  "operationId": "lookup_customer",
  "attempt": 2,
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
    "version": "0.7.0"
  }
}
```
