# @agentgauge/node

Node.js SDK for AgentGauge manual AI agent tracing and telemetry.

**0.1.0 supports:** manual tracing, token usage, latency, success/error traces, console/custom/HTTP transports, flush/shutdown.

**Not included yet:** automatic OpenAI instrumentation, hosted dashboard, cloud ingestion, cost calculation, Anthropic/Gemini.

Telemetry delivery is best-effort: transport failures never fail your application logic.

## Install

```bash
npm install @agentgauge/node
```

## Quick start

```ts
import { AgentGauge } from "@agentgauge/node";

const gauge = new AgentGauge({
  transport: { type: "console" },
});

const trace = gauge.startTrace({
  agentId: "support-agent",
  provider: "openai",
  model: "gpt-5",
});

trace.end({ inputTokens: 100, outputTokens: 30 });
await gauge.shutdown();
```

## License

Apache-2.0 — see [LICENSE](./LICENSE).
