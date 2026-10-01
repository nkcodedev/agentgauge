# AgentGauge

> Observability and cost intelligence for AI agents.

**Current release target: `0.2.0` (Milestone 2 — OpenAI Observability)**
Published npm packages today may still be `0.1.0` until `0.2.0` is released.

Licensed under the [Apache License 2.0](./LICENSE).

---

## What `0.2.0` supports

- Manual AI agent tracing (`@agentgauge/node`)
- OpenAI automatic instrumentation (`@agentgauge/openai`)
- Token usage, model, latency, success/error traces
- Console, custom, HTTP, and batched transports

## Not included yet

- Hosted AgentGauge API / cloud ingestion
- Dashboard
- Cost calculation
- Anthropic / Gemini integrations
- Budgets, alerts, governance

---

## Install

```bash
npm install @agentgauge/node @agentgauge/openai openai
```

Requires **Node.js >= 20**. Peer: `openai` `^4 || ^5 || ^6`.

---

## Quick start (OpenAI)

```ts
import OpenAI from "openai";
import { AgentGauge } from "@agentgauge/node";
import { observeOpenAI } from "@agentgauge/openai";

const gauge = new AgentGauge({
  transport: { type: "console" },
});

const openai = observeOpenAI(new OpenAI(), {
  gauge,
  agentId: "support-agent",
});

const response = await openai.responses.create({
  model: "gpt-4.1-mini",
  input: "Explain circuit breakers simply.",
});
```

Prompts and completions are **not** captured. Streaming (`stream: true`) is passed through without telemetry in `0.2.0`.

### Manual tracing

```ts
import { AgentGauge } from "@agentgauge/node";

const gauge = new AgentGauge({ transport: { type: "console" } });
const trace = gauge.startTrace({ agentId: "support-agent" });
trace.end({ inputTokens: 100, outputTokens: 30 });
await gauge.shutdown();
```

---

## Packages

| Package              | Role                   | Version |
| -------------------- | ---------------------- | ------- |
| `@agentgauge/core`   | Shared contracts       | `0.2.0` |
| `@agentgauge/node`   | Node.js SDK            | `0.2.0` |
| `@agentgauge/openai` | OpenAI instrumentation | `0.2.0` |

---

## Development

```bash
pnpm install
pnpm check
pnpm --filter @agentgauge/openai-example start
```

See [`docs/CONTRIBUTING.md`](./docs/CONTRIBUTING.md).

---

## Documentation

| Document                                   | Description                     |
| ------------------------------------------ | ------------------------------- |
| [Product scope](./docs/PRODUCT_SCOPE.md)   | What we build and what we don’t |
| [Architecture](./docs/ARCHITECTURE.md)     | Packages, apps, boundaries      |
| [Telemetry spec](./docs/TELEMETRY_SPEC.md) | `TraceEvent` contract           |
| [Milestones](./docs/MILESTONES.md)         | Delivery plan                   |
| [Decisions](./docs/DECISIONS.md)           | ADR log                         |
| [Changelog](./CHANGELOG.md)                | Release notes                   |

---

## Roadmap

1. **0.1.0** — Core SDK ✅
2. **0.2.0** — OpenAI observability ✅ (this milestone)
3. **0.3.0** — Cloud telemetry ingestion, persistence, cost estimation
4. **0.4.0** — Public MVP dashboard

---

## License

Copyright 2026 The AgentGauge Authors

Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE).
