# @agentgauge/openai

OpenAI automatic instrumentation for AgentGauge.

**v0.2.0 supports (non-streaming):**

- `client.responses.create(...)`
- `client.chat.completions.create(...)`

**Not supported yet:** streaming (`stream: true` is passed through without telemetry), embeddings, images, audio, assistants, realtime, batches.

Telemetry is metadata-first: prompts, messages, and completions are never captured automatically.

## Install

```bash
npm install @agentgauge/node @agentgauge/openai openai
```

Peer dependency: `openai` `^4 || ^5 || ^6`.

## Quick start

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

## License

Apache-2.0 — see [LICENSE](./LICENSE).
