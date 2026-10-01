# AgentGauge Architecture

**Status:** Milestone 4 (`0.4.0`) — SDK + API + worker + PostgreSQL + dashboard
**Related:** [PRODUCT_SCOPE.md](./PRODUCT_SCOPE.md), [DECISIONS.md](./DECISIONS.md)

---

## Repository Layout

```text
agentgauge/
├── apps/
│   ├── api/
│   ├── worker/
│   └── dashboard/     # Next.js App Router + Tailwind
├── packages/
│   ├── core/
│   ├── node/
│   ├── openai/
│   └── db/
├── examples/
├── docs/
└── docker-compose.yml
```

---

## Data flow

```text
SDK → AgentGauge API → PostgreSQL → Cost Engine → Dashboard
```

Dashboard consumes HTTP APIs only (never imports `@agentgauge/db`).

---

## Boundaries

- `packages/core|node|openai` must not import apps/db/fastify/drizzle
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

- [API_DESIGN.md](./API_DESIGN.md)
- [SECURITY.md](./SECURITY.md)
- [MILESTONES.md](./MILESTONES.md)
