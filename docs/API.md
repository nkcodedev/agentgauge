# AgentGauge API

**Status:** Implemented through Milestone Run Observability (`0.7.0` local)
**Related:** [TELEMETRY.md](./TELEMETRY.md), [SECURITY.md](../SECURITY.md), [ARCHITECTURE.md](./ARCHITECTURE.md)

Machine-readable sketch: `GET /openapi.json`.

---

## Authentication

```http
Authorization: Bearer ag_live_<secret>
```

Project API key authorizes ingestion, query, runs, API-key management, model-pricing management, and SSE streams (MVP).

Model pricing is an **installation-wide** catalog, not a per-project table. Any valid project API key on this server can read and change it. That matches the current self-hosted admin key; it is not a separate admin role.

---

## Endpoints

| Method | Path | Notes |
|--------|------|-------|
| POST | `/v1/traces` | Batch ingest `{ events }` → **202**; emits `trace.created` for new rows |
| POST | `/v1/traces/batch` | Alias |
| POST | `/v1/runs` | Create/start a run → **201**; emits `run.created` |
| GET | `/v1/runs` | List runs (filters + cursor pagination) |
| GET | `/v1/runs/:runId` | Run detail + aggregates (+ recent traces) |
| POST | `/v1/runs/:runId/end` | End run with terminal status; emits `run.updated` when status changes |
| GET | `/v1/events/stream` | Project-scoped SSE (`text/event-stream`) |
| GET | `/v1/usage` | Aggregates; optional `interval=hour\|day` → `series`, `activeAgents` |
| GET | `/v1/agents` | Agent summaries |
| GET | `/v1/agents/:agentId` | One agent |
| GET | `/v1/traces` | Cursor pagination + filters (`runId` supported) |
| GET | `/v1/traces/:eventId` | Trace detail |
| GET | `/v1/api-keys` | Prefix/metadata only |
| POST | `/v1/api-keys` | Create; plaintext returned **once** |
| POST | `/v1/api-keys/:id/revoke` | Soft revoke |
| GET | `/v1/model-pricing` | List installation pricing (`provider`, `model`, `q`, `status`, `source`) |
| POST | `/v1/model-pricing` | Add custom pricing or an override of a seeded model |
| POST | `/v1/model-pricing/:id/supersede` | Close a user rate and append a new effective window |
| POST | `/v1/model-pricing/:id/reset` | End an override so the AgentGauge default applies again |
| GET | `/health` | Liveness |
| GET | `/openapi.json` | Spec sketch |

### Ingestion notes

- Max 100 events / batch; validate all-or-nothing
- Duplicate `eventId` → idempotent 202 **without** a second SSE notification
- `trace.created` is emitted only after successful insert + cost enrichment
- Optional `runId` / `operationId` / `attempt` associate a trace with a run
- If `runId` is set: run must exist in the same project; `agentId` must match the run’s agent

### Runs

A **run** is one logical agent execution / user task that may contain many traces.

Final run status is **application-declared**. Child trace errors do **not** automatically fail the run.

#### Create

```http
POST /v1/runs
Content-Type: application/json

{
  "id": "run_optional_client_id",
  "name": "customer-support-request",
  "agentId": "support-agent",
  "metadata": { "channel": "email" },
  "startedAt": "2026-10-01T10:30:00.000Z"
}
```

- `status` starts as `running`
- Omit `id` to let the server generate one
- Avoid putting prompts, messages, or secrets in `name` / `metadata`

#### End

```http
POST /v1/runs/:runId/end

{
  "status": "success",
  "endedAt": "2026-10-01T10:31:00.000Z"
}
```

Allowed transitions: `running` → `success` | `error` | `cancelled` | `timeout`.

- Same terminal status again → **200** idempotent (no duplicate SSE)
- Different terminal after terminal → **409**

#### Aggregates (list + detail)

| Field | Definition |
|-------|------------|
| `requestCount` | Count of traces with this `runId` |
| `totalTokens` | `SUM(trace.totalTokens)` |
| `estimatedCost` | Sum of **known** persisted trace costs |
| `hasUnknownCost` | `true` if any child has `cost_status = unknown_model` |
| `errorCount` | Count of traces with `status = error` |
| `retryCount` | Per `operationId`: `max(attempt) - 1`, then sum (0 when attempt fields absent) |
| `durationMs` | `endedAt - startedAt` (or `now - startedAt` while running) — **not** sum of latencies |
| `status` | Explicit run outcome — independent of child errors |

#### List filters

`agentId`, `status`, `from`, `to`, `limit`, `cursor` (startedAt DESC).

### Live events (SSE)

```text
event: ready
data: {"projectId":"...","occurredAt":"..."}

event: run.created
data: {"type":"run.created","projectId":"...","agentId":"...","runId":"...","occurredAt":"..."}

event: run.updated
data: {"type":"run.updated","projectId":"...","agentId":"...","runId":"...","status":"success","occurredAt":"..."}

event: trace.created
data: {"type":"trace.created","projectId":"...","agentId":"...","eventId":"...","occurredAt":"..."}

: heartbeat
```

Heartbeat comments (~20s) do not trigger dashboard refetches. Fan-out is in-memory / single API process.
- API key project is authoritative (`project_mismatch` on conflict)

### Usage notes

- `from` / `to` ISO timestamps
- `interval=hour|day` adds `series: [{ bucket, requests, totalTokens, estimatedCost, errors }]`
- `activeAgents` counts distinct agents in range

### API keys

- Create response includes `apiKey` plaintext once
- List never returns full key or hash
- Revoked keys fail subsequent auth

### Model pricing

Installation catalog. Costs already stored on traces are not recalculated.

```http
POST /v1/model-pricing
{
  "provider": "acme",
  "model": "widget-v1",
  "inputPricePerMillion": "1.50",
  "outputPricePerMillion": "3.00",
  "effectiveFrom": "2026-10-01T00:00:00.000Z"
}
```

- Seeded provider+model → `kind: "override"`. Otherwise `kind: "custom"`.
- `POST /v1/model-pricing/:id/supersede` closes that user row at the new `effectiveFrom` and inserts the next rate. AgentGauge default rows are rejected.
- `POST /v1/model-pricing/:id/reset` ends an override. The row stays as history; the default rate applies again afterward.
- Overlapping user windows for the same provider and model return **409**.
- Matching is exact. There is no fuzzy model aliasing.

---

## Dashboard BFF

Browser calls:

- `/api/backend/v1/*` — JSON proxy for mutations (e.g. API keys)
- `/api/events` — SSE proxy for live updates

Both attach server-only `AGENTGAUGE_API_KEY`. The browser never receives the project key.
