# @agentgauge/anthropic

Anthropic automatic instrumentation for AgentGauge.

## Install

```bash
npm install @agentgauge/node @agentgauge/anthropic @anthropic-ai/sdk
```

Peer dependency: `@anthropic-ai/sdk` `>=0.39.0 <1.0.0`. Requires **Node.js >= 20**.

## Supported (non-streaming)

- `client.messages.create(...)`

Streaming (`stream: true`) is returned unmodified **without** AgentGauge telemetry.

Not instrumented yet: `messages.stream`, batches, or other Anthropic resources.

Telemetry is metadata-first: prompts, messages, and completions are never captured automatically.

## Quick start

```ts
import Anthropic from "@anthropic-ai/sdk";
import { AgentGauge } from "@agentgauge/node";
import { observeAnthropic } from "@agentgauge/anthropic";

const gauge = new AgentGauge({
  apiKey: process.env.AGENTGAUGE_API_KEY,
  endpoint: process.env.AGENTGAUGE_ENDPOINT,
});

const anthropic = observeAnthropic(new Anthropic(), {
  gauge,
  agentId: "support-agent",
});

await anthropic.messages.create({
  model: "claude-sonnet-4-5",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello" }],
});
```

`ANTHROPIC_API_KEY` authenticates with Anthropic. `AGENTGAUGE_API_KEY` authenticates telemetry with AgentGauge.

## Privacy

AgentGauge does not store prompts, completions, or message content by default. Only operational telemetry (provider, model, tokens, latency, status, sanitized errors) is recorded.

## License

Licensed under [Apache-2.0](https://github.com/nkcodedev/agentgauge/blob/main/LICENSE).
