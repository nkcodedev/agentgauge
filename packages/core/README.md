# @agentgauge/core

Provider-neutral telemetry contracts, validation, and shared primitives for AgentGauge.

This package is **runtime-neutral**: no Node.js APIs, HTTP clients, or provider SDKs.

Most applications should depend on [`@agentgauge/node`](https://www.npmjs.com/package/@agentgauge/node) rather than importing `@agentgauge/core` directly.

## Install

```bash
npm install @agentgauge/core
```

Requires **Node.js >= 20** when used from AgentGauge Node packages.

## Role in AgentGauge

```text
@agentgauge/core  ← shared TraceEvent / validation types
       ↑
@agentgauge/node  ← SDK + transports
       ↑
@agentgauge/openai
```

## License

Licensed under [Apache-2.0](https://github.com/nkcodedev/agentgauge/blob/main/LICENSE).
