# AgentGauge Architecture

**Status:** Milestone 3 (`0.3.0`) — SDK + API + worker + PostgreSQL
**Related:** [PRODUCT_SCOPE.md](./PRODUCT_SCOPE.md), [DECISIONS.md](./DECISIONS.md), [TELEMETRY_SPEC.md](./TELEMETRY_SPEC.md)

---

## Goals

- Clear separation between contracts, runtime SDK, provider adapters, and cloud apps
- Provider-neutral core that can grow beyond OpenAI
- Best-effort telemetry that cannot break customer applications
- Server-side cost intelligence without leaking backend deps into npm SDK packages

---

## Repository Layout

```text
agentgauge/
├── apps/
│   ├── api/           # Fastify ingestion + query API
│   └── worker/        # Cost enrichment for pending traces
│
├── packages/
│   ├── core/          # @agentgauge/core
│   ├── node/          # @agentgauge/node
│   ├── openai/        # @agentgauge/openai
│   └── db/            # @agentgauge/db (private)
│
├── examples/
├── docs/
├── scripts/
├── infrastructure/
└── docker-compose.yml
```

`apps/dashboard` is deferred to Milestone 4.

---

## Data flow (0.3.0)

```text
SDK (@agentgauge/node)
  → POST /v1/traces (Bearer API key)
  → apps/api validates + persists TraceEvent
  → PostgreSQL (traces, agents, …)
  → synchronous cost enrichment on ingest
  → apps/worker polls cost_status=pending (backfill)
  → GET /v1/usage | /v1/agents | /v1/traces
```

```text
Customer app
  OpenAI → @agentgauge/openai → @agentgauge/node
  Manual traces ───────────────→ @agentgauge/node
                                      │
                                      ▼
                                 apps/api
                                      │
                                      ▼
                                 PostgreSQL ← apps/worker
```

---

## Package Responsibilities

| Package / app | Role |
|---------------|------|
| `@agentgauge/core` | Portable TraceEvent contracts, validation, errors |
| `@agentgauge/node` | Manual tracing, transports, cloud `endpoint`/`apiKey` DX |
| `@agentgauge/openai` | OpenAI instrumentation |
| `@agentgauge/db` | Private Drizzle schema, migrations, pricing, enrich |
| `apps/api` | Ingestion + query HTTP API |
| `apps/worker` | Pending cost enrichment loop |

### Hard rules

1. Packages never import from `apps/`.
2. `core` never imports `node`, providers, db, Fastify.
3. `node` never imports providers, db, Fastify, apps.
4. `openai` never imports db, Fastify, apps.
5. Cost pricing tables live on the server ([ADR-004](./DECISIONS.md#adr-004-cost-calculation-belongs-primarily-on-the-server)).
6. Dashboard (future) talks to the API only.

Enforced by `node scripts/check-boundaries.mjs`.

---

## Dependency Direction

```text
@agentgauge/core
        ↑
@agentgauge/node
        ↑
@agentgauge/openai

apps/api     → @agentgauge/core, @agentgauge/db
apps/worker  → @agentgauge/db (+ core if needed)
```

---

## Local development

```bash
docker compose up -d
pnpm db:migrate
pnpm dev:seed
pnpm dev
```

---

## Explicit Non-Architecture (for now)

- Redis / Kafka for MVP ingestion
- Dashboard UI
- Multi-region event buses
- Full OpenTelemetry Collector as a hard dependency

---

## Related Documents

- [API_DESIGN.md](./API_DESIGN.md)
- [SECURITY.md](./SECURITY.md)
- [MILESTONES.md](./MILESTONES.md)
- [CODING_STANDARDS.md](./CODING_STANDARDS.md)
