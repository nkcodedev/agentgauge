# AgentGauge

> Observability and cost intelligence for AI agents.

**Current release target: `0.4.0` (Milestone 4 — Web Dashboard and Public MVP)**

Licensed under the [Apache License 2.0](./LICENSE).

---

## Product flow

```text
Install SDK
→ send telemetry
→ AgentGauge API
→ PostgreSQL
→ cost intelligence
→ web dashboard
```

---

## What `0.4.0` supports

- Manual + OpenAI SDK tracing
- Cloud/self-hosted ingestion API
- PostgreSQL persistence + cost engine
- Usage / agents / traces APIs
- API-key create/list/revoke
- Web dashboard (overview, agents, traces, settings)

Auth note: the dashboard MVP uses a **server-side project API key** (`AGENTGAUGE_API_KEY`). This is temporary — not end-user login.

---

## Install (SDK)

```bash
npm install @agentgauge/node @agentgauge/openai openai
```

Requires **Node.js >= 20**.

---

## Local backend + dashboard

```bash
pnpm install
docker compose up -d
pnpm db:migrate
pnpm dev:seed          # prints one-time API key
```

Put the key into `apps/dashboard/.env.local`:

```bash
AGENTGAUGE_API_URL=http://127.0.0.1:3000
AGENTGAUGE_API_KEY=ag_live_...
```

Then:

```bash
pnpm dev
```

| Service   | Port     |
| --------- | -------- |
| API       | 3000     |
| Dashboard | 3001     |
| Worker    | (poller) |

Optional demo traces:

```bash
pnpm dev:seed-demo
```

---

## SDK → cloud

```ts
import { AgentGauge } from "@agentgauge/node";

const gauge = new AgentGauge({
  apiKey: process.env.AGENTGAUGE_API_KEY,
  endpoint: "http://localhost:3000",
});
```

---

## Packages

| Package                 | Role                   | Version |
| ----------------------- | ---------------------- | ------- |
| `@agentgauge/core`      | Shared contracts       | `0.4.0` |
| `@agentgauge/node`      | Node.js SDK            | `0.4.0` |
| `@agentgauge/openai`    | OpenAI instrumentation | `0.4.0` |
| `@agentgauge/db`        | Private DB             | `0.4.0` |
| `@agentgauge/api`       | Private API            | `0.4.0` |
| `@agentgauge/worker`    | Private worker         | `0.4.0` |
| `@agentgauge/dashboard` | Private Next.js app    | `0.4.0` |

---

## Not included yet

- User signup / OAuth / SSO
- Billing / Stripe
- Teams / RBAC
- Anthropic / Gemini
- Budgets / alerts / governance

---

## Documentation

See `docs/` — especially [API_DESIGN.md](./docs/API_DESIGN.md), [ARCHITECTURE.md](./docs/ARCHITECTURE.md), [SECURITY.md](./docs/SECURITY.md).

---

## Roadmap

1. **0.1.0** — Core SDK ✅
2. **0.2.0** — OpenAI observability ✅
3. **0.3.0** — Cloud telemetry + cost ✅
4. **0.4.0** — Web dashboard / public MVP (this milestone)

---

## License

Copyright 2026 The AgentGauge Authors

Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE).
