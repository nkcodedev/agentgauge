# @agentgauge/node

Node.js SDK for AgentGauge.

Supports manual tracing, console/custom/HTTP/`BatchedTransport`, flush, and shutdown.

Telemetry delivery is best-effort: transport failures never fail your application logic.

```ts
import { AgentGauge } from "@agentgauge/node";

const gauge = new AgentGauge({
  transport: { type: "console" },
});

const trace = gauge.startTrace({
  agentId: "support-agent",
  provider: "openai",
  model: "gpt-4.1-mini",
});

trace.end({ inputTokens: 100, outputTokens: 30 });
await gauge.shutdown();
```

For OpenAI automatic instrumentation, install `@agentgauge/openai`.

## License

Apache-2.0 — see [LICENSE](./LICENSE).
