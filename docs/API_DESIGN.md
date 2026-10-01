# AgentGauge API Design

**Status:** Implemented for Milestone 3 (`0.3.0`)
**Related:** [TELEMETRY_SPEC.md](./TELEMETRY_SPEC.md), [SECURITY.md](./SECURITY.md), [ARCHITECTURE.md](./ARCHITECTURE.md)

Machine-readable sketch: `GET /openapi.json` on the API process.

---

## Design Principles

1. **Small surface** — Ingestion + usage/query only; no dashboard management APIs yet.
2. **Predictable JSON** — Simple success bodies; `{ error: { code, message } }` on failure.
3. **Version in the path** — `/v1/...`
4. **Auth by default** — All `/v1/*` routes require a project API key.
5. **API key establishes tenant** — Payload `project` cannot switch tenants.

---

## Authentication

```http
Authorization: Bearer ag_live_<secret>
```

or `ag_test_<secret>` for non-production keys.

- Full plaintext key is shown **once** at creation (seed / `pnpm dev:create-api-key`).
- Server stores `key_prefix` + SHA-256 hash (optional pepper via `AGENTGAUGE_API_KEY_PEPPER`).
- MVP: the same project API key authorizes ingestion **and** query routes.

---

## Ingestion

### `POST /v1/traces`

Also available as `POST /v1/traces/batch` (alias).

**Request:**

```json
{
  "events": [ { "...TraceEvent": "..." } ]
}
```

- Max **100** events per batch
- Body size limit **256 KiB**
- Validate **entire batch first**; if any event is malformed → **400** and **no** rows written
- Duplicate `eventId` → **idempotent** (unique DB constraint); response still **202**

**Success:**

```http
202 Accepted
```

```json
{
  "accepted": true,
  "eventIds": ["..."],
  "duplicates": ["..."]
}
```

**Rationale for 202:** Response acknowledges acceptance for persistence/cost processing. Current implementation enriches cost synchronously on ingest; worker handles any leftover `cost_status=pending` rows.

**Project precedence:** API key's project is authoritative. If `event.project` is set and ≠ project `slug` → `400 project_mismatch`.

**Environment:** Remains event-level metadata (`development` / `staging` / `production`).

---

## Query APIs

All require the project API key. Results are **project-scoped**.

### `GET /v1/usage?from=&to=`

Aggregates: `requests`, `inputTokens`, `outputTokens`, `totalTokens`, `estimatedCost`, `errors`, `averageLatencyMs`, plus `byAgent` / `byModel` / `byProvider`.

### `GET /v1/agents`

Agent summaries (`agentId`, first/last seen, request/token/cost/error/latency stats).

### `GET /v1/agents/:agentId`

One agent summary or `404`.

### `GET /v1/traces`

Cursor pagination (`limit`, `nextCursor`). Filters: `agentId`, `provider`, `model`, `status`, `from`, `to`.

---

## Errors

| Status | Meaning |
|--------|---------|
| 400 | Validation / project mismatch |
| 401 | Missing/invalid API key |
| 404 | Agent not found |
| 429 | Rate limited (in-process; not multi-instance authoritative) |
| 500 | Internal (no stack traces in body) |

---

## Not in 0.3.0

- Dashboard session auth
- API key CRUD UI
- Budgets / alerts
- Public multi-tenant hosted SaaS hardening beyond MVP controls
