# Changelog

All notable changes to AgentGauge packages are documented here.

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
