# AgentGauge Architecture

**Status:** Milestone Run Observability (`0.7.0` local) — SDK + API + worker + PostgreSQL + real-time dashboard
**Related:** [API.md](./API.md), [SELF_HOSTING.md](./SELF_HOSTING.md), [SECURITY.md](../SECURITY.md)

---

## Repository Layout

```text
agentgauge/
├── apps/
│   ├── api/
│   ├── worker/
│   └── dashboard/     # Next.js App Router + Tailwind + SSE live updates
├── packages/
│   ├── core/
│   ├── node/
│   ├── openai/
│   ├── anthropic/
│   ├── gemini/
│   └── db/
├── examples/
├── docs/
└── docker-compose.yml
```

---

## Data flow

```text
SDK → AgentGauge API → PostgreSQL → Cost Engine → ProjectEventBus → SSE → Dashboard
```

Dashboard consumes HTTP APIs only (never imports `@agentgauge/db`). Live updates use lightweight SSE notifications; PostgreSQL query APIs remain the source of truth.

**Runs** sit above traces: `POST /v1/runs` creates a task; traces optionally reference `runId`; `POST /v1/runs/:id/end` sets the explicit final outcome. Aggregates (tokens, cost, errors, retries) are computed in SQL from child traces.

**Limitation:** the in-memory event bus fans out only within a single API process.

SSE event types: `run.created`, `run.updated`, `trace.created`.

---

## Boundaries

- `packages/core|node|openai|anthropic|gemini` must not import apps/db/fastify/drizzle
- `apps/dashboard` must not import `@agentgauge/db`, drizzle, postgres, fastify

Enforced by `scripts/check-boundaries.mjs`.

---

## Local ports

| Service | Port |
|---------|------|
| API | 3000 |
| Dashboard | 3001 |

---

## Related

- [API.md](./API.md)
- [SELF_HOSTING.md](./SELF_HOSTING.md)
- [SECURITY.md](../SECURITY.md)
- [TELEMETRY.md](./TELEMETRY.md)
