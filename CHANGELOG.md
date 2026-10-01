# Changelog

All notable changes to AgentGauge packages are documented here.

## 0.7.0

### Added

- `@agentgauge/anthropic` — automatic instrumentation for `messages.create` (non-streaming)
- `@agentgauge/gemini` — automatic instrumentation for `models.generateContent` (non-streaming)
- Multi-provider cost intelligence with maintained default prices for OpenAI, Anthropic, and Google
- Run / task-level observability: `startRun` / `endRun`, `POST /v1/runs`, and dashboard `/runs`
- Optional `runId`, `operationId`, and `attempt` on traces, including retry visibility
- Run aggregates for request count, tokens, estimated cost, duration, errors, and retries
- Real-time `run.created` and `run.updated` events
- Pricing Management UI at `/settings/model-pricing` for self-hosted administrators
- Custom model pricing and installation-level overrides of AgentGauge defaults
- Effective-dated pricing updates that keep history instead of overwriting it
- Dashboard redesign across overview, agents, runs, traces, and settings

### Notes

- A run’s final status is declared by the application. Child request errors do not automatically fail the run, and AgentGauge does not infer task success.
- AgentGauge does not detect agent loops.
- Provider streaming requests are still passed through without telemetry.
- The event bus remains process-local (one API process).
- Costs are estimates from token usage and configured prices. They can differ from provider invoices.
- Cache, batch, long-context, priority, and enterprise rates are not fully modeled. Add a custom rate when you need one.
- Model pricing is installation-wide. Any valid project API key on that server can change it. There is no separate billing admin role.
- Already priced traces keep their stored cost when a rate changes.

## 0.5.0

### Added

- Real-time dashboard updates via Server-Sent Events (`GET /v1/events/stream`)
- Project-scoped live events after completed telemetry is persisted and cost-enriched
- Dashboard `/api/events` BFF SSE proxy so the project API key never reaches browser JS
- Live / Reconnecting / Offline connection status indicator
- Automatic SSE reconnect with ~500 ms event coalescing (burst-friendly refresh)
- Overview, Agents, and Traces pages refresh automatically — no manual browser reload
- In-memory `ProjectEventBus` for single-API-process fan-out
- Public documentation polish: root `CONTRIBUTING.md` / `SECURITY.md`, `docs/API.md`, `docs/SELF_HOSTING.md`, `docs/TELEMETRY.md`

### Notes

- “Real-time” means: completed AgentGauge telemetry → SSE notification → dashboard refresh (not provider token-by-token streaming)
- Multi-replica / distributed SSE fan-out is **not** included — the current `ProjectEventBus` is process-local and supports one API process
- Anthropic/Gemini instrumentation, budgets, and alerts are not part of this release

## 0.4.0

### Added

- `apps/dashboard` — Next.js App Router dashboard (overview, agents, traces, API keys)
- API-key management endpoints: `GET/POST /v1/api-keys`, `POST /v1/api-keys/:id/revoke`
- `GET /v1/traces/:eventId` trace detail
- `GET /v1/usage?interval=hour|day` time-series + `activeAgents`
- Server-side dashboard BFF proxy (API key never exposed to browser JS)
- Dashboard Vitest component/unit tests + optional Playwright smoke

### Notes

- Dashboard auth is MVP: server-side project API key via `AGENTGAUGE_API_KEY`
- Unknown model costs render as **Cost unavailable**, never `$0`
- Charting uses **recharts**

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

- Dashboard UI was **not** included in `0.3.0`
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
