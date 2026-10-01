# AgentGauge

> Observability and cost intelligence for AI agents.

**Current release target: `0.3.0` (Milestone 3 — Cloud Telemetry and Cost Intelligence)**

Licensed under the [Apache License 2.0](./LICENSE).

Dashboard UI is **not** part of `0.3.0`.

---

## What `0.3.0` supports

### Local / manual telemetry

- Manual AI agent tracing (`@agentgauge/node`)
- OpenAI automatic instrumentation (`@agentgauge/openai`)
- Console, custom, HTTP, and batched transports

### Hosted / self-hosted AgentGauge API

```text
SDK → AgentGauge Ingestion API → PostgreSQL → Cost Engine → Usage Query API
```

- `POST /v1/traces` ingestion with API-key auth
- PostgreSQL persistence + migrations
- Server-side cost estimation with historical pricing
- `GET /v1/usage`, `/v1/agents`, `/v1/traces`
- Local Docker Compose PostgreSQL + seed script

---

## Install (SDK)

```bash
npm install @agentgauge/node @agentgauge/openai openai
```

Requires **Node.js >= 20**.

---

## Quick start — local console telemetry

```ts
import { AgentGauge } from "@agentgauge/node";

const gauge = new AgentGauge({ transport: { type: "console" } });
const trace = gauge.startTrace({ agentId: "support-agent" });
trace.end({ inputTokens: 100, outputTokens: 30 });
await gauge.shutdown();
```

---

## Quick start — send telemetry to AgentGauge API

```ts
import { AgentGauge } from "@agentgauge/node";

const gauge = new AgentGauge({
  apiKey: process.env.AGENTGAUGE_API_KEY,
  endpoint: process.env.AGENTGAUGE_ENDPOINT ?? "http://localhost:3000",
  project: "demo-project",
  environment: "development",
});

const trace = gauge.startTrace({
  agentId: "support-agent",
  provider: "openai",
  model: "gpt-4o-mini",
});
trace.end({ inputTokens: 1200, outputTokens: 320 });
await gauge.shutdown();
```

Constructor options take precedence over `AGENTGAUGE_API_KEY` / `AGENTGAUGE_ENDPOINT`.
Existing `transport: { type: "http", endpoint }` and custom transports remain supported.

Flow:

```text
trace → POST /v1/traces → PostgreSQL → cost enrichment → GET /v1/usage
```

---

## Local backend setup

```bash
pnpm install
docker compose up -d
pnpm db:migrate
pnpm dev:seed          # prints a one-time API key
pnpm dev               # API + worker
```

Copy `.env.example` to `.env` and adjust if needed. Never commit real credentials.

Useful commands:

| Command                   | Purpose                    |
| ------------------------- | -------------------------- |
| `pnpm dev:api`            | API only                   |
| `pnpm dev:worker`         | Cost enrichment worker     |
| `pnpm dev:create-api-key` | Create org/project/API key |

---

## Packages

| Package              | Role                         | Version |
| -------------------- | ---------------------------- | ------- |
| `@agentgauge/core`   | Shared contracts             | `0.3.0` |
| `@agentgauge/node`   | Node.js SDK                  | `0.3.0` |
| `@agentgauge/openai` | OpenAI instrumentation       | `0.3.0` |
| `@agentgauge/db`     | Private DB schema/migrations | `0.3.0` |
| `@agentgauge/api`    | Private Fastify API          | `0.3.0` |
| `@agentgauge/worker` | Private cost worker          | `0.3.0` |

Only `core` / `node` / `openai` are published to npm.

---

## Not included yet

- Dashboard (`apps/dashboard`)
- User login / OAuth / teams / RBAC
- Budgets, alerts, governance
- Anthropic / Gemini integrations
- Billing / Stripe

---

## Documentation

| Document                               | Description                 |
| -------------------------------------- | --------------------------- |
| [API design](./docs/API_DESIGN.md)     | Implemented HTTP API        |
| [Architecture](./docs/ARCHITECTURE.md) | Packages, apps, boundaries  |
| [Security](./docs/SECURITY.md)         | API keys, isolation, limits |
| [Milestones](./docs/MILESTONES.md)     | Delivery plan               |
| [Decisions](./docs/DECISIONS.md)       | ADR log                     |
| [Changelog](./CHANGELOG.md)            | Release notes               |

---

## Roadmap

1. **0.1.0** — Core SDK ✅
2. **0.2.0** — OpenAI observability ✅
3. **0.3.0** — Cloud telemetry + cost intelligence (this milestone)
4. **0.4.0** — Public MVP dashboard

---

## License

Copyright 2026 The AgentGauge Authors

Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE).
