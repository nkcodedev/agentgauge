# Changelog

All notable changes to AgentGauge packages are documented here.

## 0.3.0

### Added

- AgentGauge Ingestion API (`apps/api`) — `POST /v1/traces`, `POST /v1/traces/batch`
- Usage query API — `GET /v1/usage`, `GET /v1/agents`, `GET /v1/agents/:agentId`, `GET /v1/traces`
- PostgreSQL persistence via private `@agentgauge/db` (Drizzle ORM + migrations)
- API-key authentication (`ag_live_` / `ag_test_`) with SHA-256(+pepper) storage
- Server-side cost engine with historical `model_pricing` rows
- Agent auto-discovery on ingest
- Cost enrichment worker (`apps/worker`) for pending rows
- `@agentgauge/node` convenience `endpoint` + `apiKey` (and env vars) for hosted ingestion
- Docker Compose PostgreSQL, seed script, local developer workflow

### Notes

- Dashboard UI is **not** included in `0.3.0`
- Unknown models store tokens with `null` cost (never fabricated)
- In-process rate limiting is single-instance only
- Batch ingestion validates all-or-nothing; duplicate `eventId`s are idempotent

## 0.2.0

### Added

- `@agentgauge/openai` — automatic OpenAI instrumentation
- Support for `responses.create` and `chat.completions.create` (non-streaming)
- `BatchedTransport` in `@agentgauge/node`
- OpenAI example (`examples/openai`)

### Notes

- Streaming OpenAI requests are passed through without telemetry
- Prompts/completions are never captured by default

## 0.1.0

### Added

- Initial public release
- `@agentgauge/core` — shared telemetry contracts, validation, and errors
- `@agentgauge/node` — Node.js SDK for manual AI agent tracing
- Manual tracing lifecycle (`startTrace` / `end` / `fail`)
- Token usage recording (with derived `totalTokens`)
- Latency tracking
- Success and error traces
- Console, custom, and HTTP transport foundation
- Best-effort telemetry delivery (transport failures do not break customer apps)
- `flush()` / `shutdown()` lifecycle APIs
