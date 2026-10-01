# @agentgauge/node

Node.js SDK for AgentGauge (`0.3.0`).

Supports manual tracing, console/custom/HTTP/`BatchedTransport`, and hosted API ingestion via `apiKey` + `endpoint`.

Telemetry delivery is best-effort: transport failures never fail your application logic.

## Local / console

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
const gauge = new AgentGauge({
  apiKey: process.env.AGENTGAUGE_API_KEY,
  endpoint: process.env.AGENTGAUGE_ENDPOINT ?? "http://localhost:3000",
});
```

Constructor options take precedence over `AGENTGAUGE_API_KEY` / `AGENTGAUGE_ENDPOINT`.
Explicit `transport` still wins when provided.

For OpenAI automatic instrumentation, install `@agentgauge/openai`.

## License

Apache-2.0 — see [LICENSE](./LICENSE).
