# @agentgauge/gemini

Google Gemini automatic instrumentation for AgentGauge.

## Install

```bash
npm install @agentgauge/node @agentgauge/gemini @google/genai
```

Peer dependency: `@google/genai` `^1 || ^2`. Requires **Node.js >= 20**.

## Supported (non-streaming)

- `client.models.generateContent(...)`

Streaming (`models.generateContentStream`) is returned unmodified **without** AgentGauge telemetry.

Not instrumented yet: chats, files, live, embeddings, caches, batches, or other SDK namespaces.

Telemetry is metadata-first: prompts, contents, and generated text are never captured automatically.

Canonical AgentGauge `provider` value: **`google`** (Gemini is the model family).

## Quick start

```ts
import { GoogleGenAI } from "@google/genai";
import { AgentGauge } from "@agentgauge/node";
import { observeGemini } from "@agentgauge/gemini";

const gauge = new AgentGauge({
  apiKey: process.env.AGENTGAUGE_API_KEY,
  endpoint: process.env.AGENTGAUGE_ENDPOINT,
});

const ai = observeGemini(
  new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  }),
  {
    gauge,
    agentId: "support-agent",
  },
);

await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "Hello",
});
```

`GEMINI_API_KEY` (or Google GenAI auth) authenticates with Google. `AGENTGAUGE_API_KEY` authenticates telemetry with AgentGauge.

## Privacy

AgentGauge does not store prompts, generated content, or candidates by default. Only operational telemetry (provider, model, tokens, latency, status, sanitized errors) is recorded.

## License

Licensed under [Apache-2.0](https://github.com/nkcodedev/agentgauge/blob/main/LICENSE).
