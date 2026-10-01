# @agentgauge/node

Node.js SDK for AgentGauge — manual tracing, transports, and hosted ingestion.

Telemetry delivery is **best-effort**: transport failures never fail your application logic.

## Install

```bash
npm install @agentgauge/node
```

Requires **Node.js >= 20**.

## Console / local

```ts
import { AgentGauge } from "@agentgauge/node";

const gauge = new AgentGauge({
  transport: { type: "console" },
});

const trace = gauge.startTrace({
  agentId: "support-agent",
  provider: "openai",
  model: "gpt-4o-mini",
});

trace.end({ inputTokens: 100, outputTokens: 30 });
await gauge.shutdown();
```

## Hosted / self-hosted API

```ts
import { AgentGauge } from "@agentgauge/node";

const gauge = new AgentGauge({
  apiKey: process.env.AGENTGAUGE_API_KEY,
  endpoint: process.env.AGENTGAUGE_ENDPOINT ?? "http://localhost:3000",
});
```

Constructor options take precedence over `AGENTGAUGE_API_KEY` / `AGENTGAUGE_ENDPOINT`. An explicit `transport` still wins when provided.

`AGENTGAUGE_API_KEY` authenticates with **AgentGauge**, not your LLM provider.

For OpenAI automatic instrumentation, install [`@agentgauge/openai`](https://www.npmjs.com/package/@agentgauge/openai).

## License

Licensed under [Apache-2.0](https://github.com/nkcodedev/agentgauge/blob/main/LICENSE).
