# AgentGauge API Design

**Status:** Implemented through Milestone 4 (`0.4.0`)
**Related:** [TELEMETRY_SPEC.md](./TELEMETRY_SPEC.md), [SECURITY.md](./SECURITY.md), [ARCHITECTURE.md](./ARCHITECTURE.md)

Machine-readable sketch: `GET /openapi.json`.

---

## Authentication

```http
Authorization: Bearer ag_live_<secret>
```

Project API key authorizes ingestion, query, and API-key management (MVP).

---

## Endpoints

| Method | Path | Notes |
|--------|------|-------|
| POST | `/v1/traces` | Batch ingest `{ events }` → **202** |
| POST | `/v1/traces/batch` | Alias |
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
- Duplicate `eventId` → idempotent 202
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

Browser calls `/api/backend/v1/*` on the dashboard. The Next.js route attaches server-only `AGENTGAUGE_API_KEY`.
