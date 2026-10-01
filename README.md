# AgentGauge

Open-source observability and cost intelligence for AI agents.

Track requests, tokens, cost, latency, errors, agents, models, and traces in real time.

[![npm @agentgauge/node](https://img.shields.io/npm/v/@agentgauge/node.svg?label=%40agentgauge%2Fnode)](https://www.npmjs.com/package/@agentgauge/node)
[![npm @agentgauge/openai](https://img.shields.io/npm/v/@agentgauge/openai.svg?label=%40agentgauge%2Fopenai)](https://www.npmjs.com/package/@agentgauge/openai)
[![npm @agentgauge/anthropic](https://img.shields.io/npm/v/@agentgauge/anthropic.svg?label=%40agentgauge%2Fanthropic)](https://www.npmjs.com/package/@agentgauge/anthropic)
[![npm @agentgauge/gemini](https://img.shields.io/npm/v/@agentgauge/gemini.svg?label=%40agentgauge%2Fgemini)](https://www.npmjs.com/package/@agentgauge/gemini)
[![Node.js >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)

---

AgentGauge gives engineering teams visibility into how AI agents behave in production.

See which agents are running, how many tokens they consume, what they cost, which models they use, where failures occur, and how usage changes over time.

**AgentGauge does not store prompts or completions by default.** Telemetry is metadata-first: operational signals only, not conversational content.

---

## Dashboard

The self-hosted dashboard shows overview KPIs, agents, runs, traces, API keys, and model pricing.

Screenshots belong in [`docs/assets/`](./docs/assets/) (see that folder’s README). Add PNGs named:

```text
docs/assets/dashboard-overview.png
docs/assets/dashboard-agents.png
docs/assets/dashboard-traces.png
```

Then reference them here once captured from a local demo (never include real secrets).

---

## Features

- Real-time dashboard updates (SSE)
- Manual AI agent / request tracing
- Run / task-level observability (explicit start/end, independent of child errors)
- Retry and attempt visibility inside a run
- Automatic OpenAI / Anthropic / Gemini instrumentation
- Token usage tracking
- Server-side estimated cost intelligence
- Agent-level analytics
- Model and provider breakdowns
- Latency monitoring
- Error tracking
- Trace explorer with filters and pagination
- Project API-key create / list / revoke
- Historical model pricing, including custom models and effective-dated updates from the dashboard
- Self-hosted API + PostgreSQL + dashboard
- Metadata-first / privacy-first telemetry

---

## Quick start

### Install

```bash
npm install @agentgauge/node
```

For OpenAI automatic instrumentation:

```bash
npm install @agentgauge/node @agentgauge/openai openai
```

Requires **Node.js >= 20**.

### Manual tracing

```ts
import { AgentGauge } from "@agentgauge/node";

const gauge = new AgentGauge({
  apiKey: process.env.AGENTGAUGE_API_KEY,
  endpoint: process.env.AGENTGAUGE_ENDPOINT ?? "http://localhost:3000",
});

const trace = gauge.startTrace({
  agentId: "support-agent",
  provider: "openai",
  model: "gpt-4o-mini",
});

trace.end({ inputTokens: 100, outputTokens: 30 });
await gauge.shutdown();
```

For local development without a backend, use `transport: { type: "console" }` instead of `apiKey` / `endpoint`.

### Run / task-level observability

```ts
const run = gauge.startRun({
  name: "customer-support-request",
  agentId: "support-agent",
});

try {
  const trace = gauge.startTrace({
    agentId: "support-agent",
    runId: run.id,
    operationId: "lookup_customer",
    attempt: 1,
  });
  // ... work ...
  trace.end({ inputTokens: 100, outputTokens: 40 });
  await run.end({ status: "success" });
} catch (error) {
  await run.end({ status: "error" });
  throw error;
}
```

Final run status is declared by your application — child request errors do not automatically fail the run.

### OpenAI instrumentation

```ts
import OpenAI from "openai";
import { AgentGauge } from "@agentgauge/node";
import { observeOpenAI } from "@agentgauge/openai";

const gauge = new AgentGauge({
  apiKey: process.env.AGENTGAUGE_API_KEY,
  endpoint: process.env.AGENTGAUGE_ENDPOINT,
});

const openai = observeOpenAI(new OpenAI(), {
  gauge,
  agentId: "support-agent",
});

await openai.responses.create({
  model: "gpt-4o-mini",
  input: "Hello",
});
```

### AgentGauge API key vs provider key

| Key                  | Purpose                                 |
| -------------------- | --------------------------------------- |
| `OPENAI_API_KEY`     | Authenticates with OpenAI               |
| `AGENTGAUGE_API_KEY` | Authenticates telemetry with AgentGauge |

AgentGauge does **not** replace your provider API key. Both may be required when sending OpenAI traffic and AgentGauge telemetry.

---

## How it works

```text
Your AI application
      │
      ▼
@agentgauge/node / openai / anthropic / gemini
      │
      ▼
AgentGauge API
      │
      ▼
PostgreSQL
      │
      ├── Cost Engine
      └── Event Bus
              │
              ▼
             SSE
              │
              ▼
      Real-Time Dashboard
```

- **PostgreSQL** is the source of truth for traces, agents, usage, and costs.
- Telemetry is **validated, authenticated, and persisted** before live events are published.
- SSE carries a lightweight `trace.created` signal — not the full dashboard state.
- The dashboard refetches canonical APIs (`/v1/usage`, `/v1/agents`, `/v1/traces`, …).
- The current event bus is **in-memory and single-API-process**; multi-replica fan-out needs distributed pub/sub later.

---

## Real-time dashboard

When a completed trace is persisted, AgentGauge publishes a project-scoped event through SSE. The dashboard receives the event and refreshes relevant metrics automatically.

**No manual browser refresh is required.**

Details:

- ~**500 ms** event coalescing (bursts refetch once)
- Automatic reconnect with backoff
- **Live / Reconnecting / Offline** connection status in the UI

“Real-time” means: completed AgentGauge telemetry updates the dashboard live. It does **not** mean provider token-by-token streaming.

---

## Packages

| Package                                                                        | Purpose                                 |
| ------------------------------------------------------------------------------ | --------------------------------------- |
| [`@agentgauge/core`](https://www.npmjs.com/package/@agentgauge/core)           | Provider-neutral telemetry contracts    |
| [`@agentgauge/node`](https://www.npmjs.com/package/@agentgauge/node)           | Node.js SDK and transports              |
| [`@agentgauge/openai`](https://www.npmjs.com/package/@agentgauge/openai)       | OpenAI automatic instrumentation        |
| [`@agentgauge/anthropic`](https://www.npmjs.com/package/@agentgauge/anthropic) | Anthropic automatic instrumentation     |
| [`@agentgauge/gemini`](https://www.npmjs.com/package/@agentgauge/gemini)       | Google Gemini automatic instrumentation |

Apps under `apps/` (`api`, `worker`, `dashboard`) and `packages/db` are part of the self-hosted platform and are not published to npm.

---

## Provider support

Supported (**non-streaming**):

- OpenAI `responses.create` and `chat.completions.create` (`@agentgauge/openai`)
- Anthropic `messages.create` (`@agentgauge/anthropic`)
- Google Gemini `models.generateContent` (`@agentgauge/gemini`)

Streaming requests currently pass through **without** AgentGauge telemetry.

Not instrumented yet: embeddings, images, audio, assistants, realtime, and batches.

---

## What AgentGauge records

| Data              | Recorded                    |
| ----------------- | --------------------------- |
| Agent ID          | Yes                         |
| Provider / model  | Yes                         |
| Token usage       | Yes                         |
| Latency           | Yes                         |
| Status / errors   | Yes                         |
| Estimated cost    | Yes (when pricing is known) |
| Tags / metadata   | Yes                         |
| Prompt text       | **No** by default           |
| Completion text   | **No** by default           |
| Provider API keys | **Never**                   |

---

## Cost intelligence

- Cost is calculated **server-side** on ingest.
- Pricing uses provider + model + effective date ranges in `model_pricing`.
- AgentGauge ships default prices. Self-hosted admins can add custom models or override a default from **Settings → Model pricing**.
- Updates are effective-dated. Historical pricing rows stay in place, and already priced traces keep their stored cost.
- Unknown models keep token counts and show **Cost unavailable** (never a fabricated `$0`) until a matching rate exists.
- Pricing tables require maintenance and are **not** guaranteed to mirror live provider rate cards. AgentGauge does not scrape provider price pages.

Costs are **estimates** for observability — not provider invoice amounts.

---

## Self-hosting

**PostgreSQL 16+** is required for the AgentGauge API, worker, and dashboard.

PostgreSQL is **not** required to use the SDK with console or custom transports alone.

```text
SDK → AgentGauge API → PostgreSQL → Dashboard
```

```bash
pnpm install
docker compose up -d
pnpm db:migrate
pnpm dev:seed          # prints a one-time API key
```

Configure `apps/dashboard/.env.local`, then `pnpm dev`. Full steps: [`docs/SELF_HOSTING.md`](./docs/SELF_HOSTING.md).

| Service   | URL                                |
| --------- | ---------------------------------- |
| API       | http://localhost:3000              |
| Dashboard | http://localhost:3001              |
| Health    | http://localhost:3000/health       |
| OpenAPI   | http://localhost:3000/openapi.json |

---

## API overview

| Method       | Path                                     |
| ------------ | ---------------------------------------- |
| `POST`       | `/v1/traces`, `/v1/traces/batch`         |
| `GET`        | `/v1/usage`                              |
| `GET`        | `/v1/agents`, `/v1/agents/:agentId`      |
| `GET`        | `/v1/traces`, `/v1/traces/:eventId`      |
| `GET`/`POST` | `/v1/runs` (+ `/:runId`, `/:runId/end`)  |
| `GET`        | `/v1/events/stream`                      |
| `GET`/`POST` | `/v1/api-keys` (+ revoke)                |
| `GET`/`POST` | `/v1/model-pricing` (+ supersede, reset) |

See [`docs/API.md`](./docs/API.md) and `GET /openapi.json` for details.

---

## Security and privacy

- Project API keys are hashed at rest (SHA-256, optional pepper).
- Plaintext keys are shown **once** at creation.
- Access is project-scoped; revocation is supported.
- Prompts and completions are not collected by default.
- Provider API keys are never collected.
- SSE streams are project-isolated and do not carry secrets or prompt content.

AgentGauge is an early public MVP — treat it as pre-1.0 infrastructure, not an enterprise-certified security product.

More: [`SECURITY.md`](./SECURITY.md).

---

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm typecheck
pnpm check
```

Integration, database, and dashboard E2E tests expect a reachable PostgreSQL instance (see `docker-compose.yml`).

Further docs: [ARCHITECTURE](./docs/ARCHITECTURE.md), [TELEMETRY](./docs/TELEMETRY.md), [SELF_HOSTING](./docs/SELF_HOSTING.md), [CONTRIBUTING](./CONTRIBUTING.md).

---

## Testing

Automated coverage includes unit tests, API integration tests, database tests, SDK → API → DB E2E, dashboard component tests, and Playwright flows (including real-time dashboard updates).

---

## Project status

AgentGauge is an **early public MVP / pre-1.0** project. APIs and schemas may still evolve. See [CHANGELOG.md](./CHANGELOG.md).

Current release: **`0.7.0`**.

---

## Roadmap

Directional only — no dates:

- Budgets and alerts
- Deeper agent / tool tracing
- Distributed real-time event delivery
- Governance and policies

---

## Feedback

AgentGauge is shared early so real developers can shape the product.

If you are building AI/LLM applications, feedback on integration, observability, cost tracking, tracing, and missing workflows is especially useful. Please open a [GitHub issue](https://github.com/nkcodedev/agentgauge/issues).

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## License

Licensed under the [Apache License 2.0](./LICENSE).
