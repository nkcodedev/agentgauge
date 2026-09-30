# AgentGauge API Design

**Status:** Intentional design notes — **not implemented yet**
**Related:** [TELEMETRY_SPEC.md](./TELEMETRY_SPEC.md), [SECURITY.md](./SECURITY.md), [VERSIONING_AND_RELEASES.md](./VERSIONING_AND_RELEASES.md)

This document captures the intended HTTP API style for AgentGauge cloud services. It deliberately avoids locking unused endpoints. Implement only what the current milestone requires.

---

## Design Principles

1. **Small surface first** — Ship `POST /v1/traces` before a large query API.
2. **Predictable JSON** — Consistent success and error envelopes.
3. **Version in the path** — `/v1/...` for the first public contract.
4. **Auth by default** — No anonymous ingestion in hosted environments.
5. **Backwards compatible within a major** — Additive changes preferred; see compatibility philosophy below.
6. **Do not speculate** — Optional future routes listed here are placeholders for planning, not implementation mandates.

---

## Initial Ingestion API

### `POST /v1/traces`

Accepts one or more `TraceEvent` records from SDKs.

**Purpose:** Cloud telemetry ingestion for MVP milestones (primarily Milestone 3+).

**Conceptual request:**

```http
POST /v1/traces HTTP/1.1
Host: api.agentgauge.dev
Authorization: Bearer ag_live_...
Content-Type: application/json

{
  "events": [ { "...TraceEvent": "..." } ]
}
```

**Notes:**

- Support batch upload from the start (SDK batching).
- Validate each event; define partial-failure behavior at implementation time (reject all vs accept valid subset) and document it before GA of the endpoint.
- Enforce body size limits and per-batch event count limits.

---

## Possible Future Query APIs

These are **planning hints only**. Do not implement until a milestone explicitly requires them.

```text
GET /v1/usage
GET /v1/agents
GET /v1/agents/:id
GET /v1/traces
GET /v1/costs
```

Additional management endpoints (e.g. API key CRUD) will be defined with the dashboard milestone.

---

## Authentication Conventions

| Mechanism | Usage |
|-----------|--------|
| API key via `Authorization: Bearer <key>` | Primary for SDK ingestion and programmatic access |
| Session / user auth | Dashboard (exact scheme decided at dashboard implementation) |

### API-key format concept

Illustrative format (finalize at implementation):

```text
ag_<env>_<secret>

Examples:
  ag_live_...
  ag_test_...
```

Properties:

- Prefix identifies AgentGauge keys in secret scanning and developer mental models
- Environment marker distinguishes live vs test
- High-entropy secret portion
- Server stores a **hash** of the secret; plaintext shown once at creation

Do not treat this illustrative format as final until Milestone 3 locks it in code + docs.

---

## Versioning Strategy

- URL path version: `/v1`
- SDKs target a specific API version via base URL paths
- Additive optional JSON fields are allowed without bumping to `/v2`
- Breaking changes require `/v2` or coordinated deprecation described in release notes
- Package SemVer is separate from HTTP API path version, but should not diverge in spirit during early development

---

## Request Validation

- JSON only for V1 ingestion
- Schema validation aligned with [TELEMETRY_SPEC.md](./TELEMETRY_SPEC.md)
- Unknown fields: document chosen policy (prefer ignore for forward compatibility unless dangerous)
- Type mismatches → `400` with field-level details where safe
- Missing required fields → `400`

---

## Standard Success Response

Illustrative envelope:

```json
{
  "ok": true,
  "data": {
    "accepted": 1,
    "eventIds": ["0193e0a2-7c1b-7b6e-9f3a-2d6c8f0a1b2c"]
  }
}
```

Alternative minimal `202 Accepted` with a small body is acceptable for ingestion if documented. Pick one approach in Milestone 3 and keep it stable.

---

## Standard Error Response

Illustrative envelope:

```json
{
  "ok": false,
  "error": {
    "code": "invalid_request",
    "message": "events[0].agentId is required",
    "details": {
      "field": "events[0].agentId"
    }
  }
}
```

Rules:

- Stable `code` strings for clients
- Human-readable `message`
- No stack traces, SQL, or internal hosts in production responses
- No echo of Authorization headers or API keys

### Suggested error codes (initial set)

| Code | Typical HTTP status |
|------|---------------------|
| `invalid_request` | 400 |
| `unauthorized` | 401 |
| `forbidden` | 403 |
| `payload_too_large` | 413 |
| `rate_limited` | 429 |
| `internal_error` | 500 |

---

## Idempotency Considerations

- SDKs will retry on transient network failures
- Prefer client-generated `eventId` as a natural idempotency key for ingestion deduplication
- Optional `Idempotency-Key` header may be added later for envelope-level retries; not required for first implementation if `eventId` dedupe exists
- Document dedupe window and semantics when implemented

---

## Rate-Limit Behavior

- Rate limits apply per API key / project
- On limit exceeded: HTTP `429` with `error.code = rate_limited`
- Include standard headers when implemented, e.g. `Retry-After` and/or `X-RateLimit-*`
- SDKs should backoff and **must not** surface rate limits as customer LLM failures

---

## Backwards Compatibility Philosophy

During `0.x`:

- Breaking API changes are allowed but must be deliberate, documented, and preferably rare after Milestone 3 public ingestion
- Prefer additive fields and new endpoints over changing meaning of existing fields
- Deprecate with docs + changelog before removal when clients exist

After `1.0.0` (future):

- No breaking HTTP changes within `/v1` without deprecation period

---

## What We Are Explicitly Not Specifying Yet

- GraphQL / gRPC dual stacks
- WebSocket ingestion
- Public webhook fan-out APIs
- Full OpenAPI file as a release artifact (recommended once `POST /v1/traces` is implemented)

---

## Related Documents

- [MILESTONES.md](./MILESTONES.md)
- [SECURITY.md](./SECURITY.md)
- [DECISIONS.md](./DECISIONS.md)
