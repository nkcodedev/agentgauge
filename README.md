# AgentGauge

> Observability and cost intelligence for AI agents.

**Current release: `0.1.0` (Milestone 1 — Core SDK)**

Licensed under the [Apache License 2.0](./LICENSE).

---

## What `0.1.0` supports

- Manual AI agent tracing
- Token usage recording
- Latency measurement
- Success/error tracing
- Console transport
- Custom transport
- HTTP transport foundation
- Best-effort telemetry delivery (`flush` / `shutdown`)

## Not included in `0.1.0`

- Automatic OpenAI instrumentation
- Hosted dashboard
- Cloud ingestion service
- Cost calculation
- Anthropic integration
- Gemini integration

---

## Install

```bash
npm install @agentgauge/node
```

`@agentgauge/core` is installed automatically as a dependency of `@agentgauge/node`.

Requires **Node.js >= 20**.

---

## Quick start

```ts
import { AgentGauge } from "@agentgauge/node";

const gauge = new AgentGauge({
  project: "my-project",
  environment: "development",
  transport: { type: "console" },
});

const trace = gauge.startTrace({
  agentId: "support-agent",
  provider: "openai",
  model: "gpt-5",
  operationName: "answer-customer",
});

try {
  // your AI / business logic
  const result = { inputTokens: 1200, outputTokens: 320 };
  trace.end({
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });
} catch (error) {
  trace.fail(error);
  throw error;
}

await gauge.flush();
await gauge.shutdown();
```

### Custom transport

```ts
import { AgentGauge, type TraceEvent } from "@agentgauge/node";

const events: TraceEvent[] = [];

const gauge = new AgentGauge({
  transport: {
    async send(event) {
      events.push(event);
    },
  },
});
```

### HTTP transport foundation

```ts
import { AgentGauge } from "@agentgauge/node";

const gauge = new AgentGauge({
  apiKey: "ag_test_example",
  transport: {
    type: "http",
    endpoint: "https://api.example.com/v1/traces",
  },
});
```

HTTP delivery failures are best-effort: they never fail your application logic.

---

## Packages

| Package            | Role                                 | Version |
| ------------------ | ------------------------------------ | ------- |
| `@agentgauge/core` | Shared contracts, validation, errors | `0.1.0` |
| `@agentgauge/node` | Node.js SDK                          | `0.1.0` |

---

## Development

```bash
pnpm install
pnpm check
pnpm --filter @agentgauge/manual-node-example start
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
2. **0.2.0** — OpenAI observability
3. **0.3.0** — Cloud telemetry ingestion, persistence, cost estimation
4. **0.4.0** — Public MVP dashboard

---

## License

Copyright 2026 The AgentGauge Authors

Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE).
