# @agentgauge/openai

OpenAI automatic instrumentation for AgentGauge.

## Install

```bash
npm install @agentgauge/node @agentgauge/openai openai
```

Peer dependency: `openai` `^4 || ^5 || ^6`. Requires **Node.js >= 20**.

## Supported (non-streaming)

- `client.responses.create(...)`
- `client.chat.completions.create(...)`

Streaming (`stream: true`) is returned unmodified **without** AgentGauge telemetry.

Not instrumented yet: embeddings, images, audio, assistants, realtime, batches.

Telemetry is metadata-first: prompts, messages, and completions are never captured automatically.

## Quick start

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

`OPENAI_API_KEY` authenticates with OpenAI. `AGENTGAUGE_API_KEY` authenticates telemetry with AgentGauge.

## License

Licensed under [Apache-2.0](https://github.com/nkcodedev/agentgauge/blob/main/LICENSE).
