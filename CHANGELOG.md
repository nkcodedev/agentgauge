# Changelog

All notable changes to AgentGauge packages are documented here.

## 0.2.0

### Added

- `@agentgauge/openai` — automatic OpenAI instrumentation
- Support for `responses.create` and `chat.completions.create` (non-streaming)
- `BatchedTransport` in `@agentgauge/node`
- OpenAI example (`examples/openai`)

### Notes

- Streaming OpenAI requests are passed through without telemetry
- Prompts/completions are never captured by default

## 0.1.0

### Added

- Initial public release
- `@agentgauge/core` — shared telemetry contracts, validation, and errors
- `@agentgauge/node` — Node.js SDK for manual AI agent tracing
- Manual tracing lifecycle (`startTrace` / `end` / `fail`)
- Token usage recording (with derived `totalTokens`)
- Latency tracking
- Success and error traces
- Console, custom, and HTTP transport foundation
- Best-effort telemetry delivery (transport failures do not break customer apps)
- `flush()` / `shutdown()` lifecycle APIs
