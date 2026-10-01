# AgentGauge API

**Status:** Implemented through Milestone 4.1 (`0.5.0`)
**Related:** [TELEMETRY.md](./TELEMETRY.md), [SECURITY.md](../SECURITY.md), [ARCHITECTURE.md](./ARCHITECTURE.md)

Machine-readable sketch: `GET /openapi.json`.

---

## Authentication

```http
Authorization: Bearer ag_live_<secret>
```

Project API key authorizes ingestion, query, API-key management, and SSE streams (MVP).

---

## Endpoints

| Method | Path | Notes |
|--------|------|-------|
| POST | `/v1/traces` | Batch ingest `{ events }` → **202**; emits `trace.created` for new rows |
| POST | `/v1/traces/batch` | Alias |
| GET | `/v1/events/stream` | Project-scoped SSE (`text/event-stream`) |
| GET | `/v1/usage` | Aggregates; optional `interval=hour\|day` → `series`, `activeAgents` |
| GET | `/v1/agents` | Agent summaries |
| GET | `/v1/agents/:agentId` | One agent |
| GET | `/v1/traces` | Cursor pagination + filters |
| GET | `/v1/traces/:eventId` | Trace detail |
| GET | `/v1/api-keys` | Prefix/metadata only |
| POST | `/v1/api-keys` | Create; plaintext returned **once** |
| POST | `/v1/api-keys/:id/revoke` | Soft revoke |
| GET | `/health` | Liveness |
| GET | `/openapi.json` | Spec sketch |

### Ingestion notes

- Max 100 events / batch; validate all-or-nothing
- Duplicate `eventId` → idempotent 202 **without** a second SSE notification
- `trace.created` is emitted only after successful insert + cost enrichment

### Live events (SSE)

```text
event: ready
data: {"projectId":"...","occurredAt":"..."}

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

---

## Dashboard BFF

Browser calls:

- `/api/backend/v1/*` — JSON proxy for mutations (e.g. API keys)
- `/api/events` — SSE proxy for live updates

Both attach server-only `AGENTGAUGE_API_KEY`. The browser never receives the project key.
