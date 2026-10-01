# AgentGauge Architecture

**Status:** Milestone 1 (`0.1.0`) implemented for packages; apps deferred
**Related:** [PRODUCT_SCOPE.md](./PRODUCT_SCOPE.md), [DECISIONS.md](./DECISIONS.md), [TELEMETRY_SPEC.md](./TELEMETRY_SPEC.md)

This document defines the high-level system architecture, package responsibilities, dependency direction, and hard boundary rules. Implementation must respect these boundaries from Milestone 1 onward.

---

## Goals

- Clear separation between contracts, runtime SDK, provider adapters, and cloud apps
- Provider-neutral core that can grow beyond OpenAI
- Best-effort telemetry that cannot break customer applications
- Room for API, worker, and dashboard without coupling packages to apps

---

## Repository Layout

Initial monorepo structure:

```text
agentgauge/
├── apps/              # reserved (.gitkeep); api/dashboard/worker in later milestones
│
├── packages/
│   ├── core/          # @agentgauge/core ✅ 0.2.0
│   ├── node/          # @agentgauge/node ✅ 0.2.0
│   └── openai/        # @agentgauge/openai ✅ 0.2.0
│
├── examples/
│   ├── manual-node/
│   └── openai/
├── docs/
├── scripts/
└── ...
```

`apps/*` implementations remain deferred until their milestones.
Directories may be introduced when the corresponding milestone requires them. Do not create empty app shells that pretend features exist.

---

## High-Level System Diagram

```text
┌─────────────────────────────────────────────────────────────┐
│                     Customer application                     │
│                                                             │
│   OpenAI SDK ──► @agentgauge/openai ──► @agentgauge/node    │
│                                      ▲                      │
│   Manual traces ─────────────────────┘                      │
│                              │                              │
│                         HTTP transport                      │
│                     (or custom transport)                   │
└──────────────────────────────┼──────────────────────────────┘
                               │
                               ▼
                    ┌────────────────────┐
                    │     apps/api       │
                    │  ingest + query    │
                    └─────────┬──────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │    apps/worker     │
                    │  enrich + persist  │
                    └─────────┬──────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │    PostgreSQL      │
                    └─────────┬──────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │  apps/dashboard    │
                    └────────────────────┘
```

---

## Package Responsibilities

### `@agentgauge/core`

Framework-independent contracts and primitives.

**May include:**

- Trace / event types
- Agent identity types
- Usage (token) types
- Provider identifiers (universal, not SDK-specific)
- Event schemas and validation helpers
- Shared error types (portable)
- Pure utility functions used across packages

**Must NOT depend on:**

- Node.js APIs (`fs`, `http`, `process`, etc.)
- OpenAI or any provider SDK
- Database clients
- HTTP frameworks
- Dashboard / React / UI code
- Application packages under `apps/`

`core` is the shared vocabulary of AgentGauge. Keep it portable so browser or non-Node runtimes could theoretically consume types later, even if Node is the only supported runtime initially.

---

### `@agentgauge/node`

Node.js runtime SDK.

**Responsibilities:**

- AgentGauge client construction and configuration
- Trace lifecycle (start, end, record, flush)
- HTTP transport to the ingestion API
- Custom transport interface
- Batching, retries, and backoff
- Flush / shutdown hooks
- Runtime configuration (options + environment variables)
- Emitting events shaped by `@agentgauge/core`

**May depend on:** `@agentgauge/core`
**Must NOT depend on:** provider SDKs, `apps/*`, database libraries, dashboard code

---

### `@agentgauge/openai`

OpenAI-specific instrumentation.

**Responsibilities:**

- Wrap / instrument supported OpenAI SDK calls
- Extract provider, model, and token usage
- Measure latency
- Capture errors safely
- Emit standardized AgentGauge telemetry via `@agentgauge/node`

**May depend on:** `@agentgauge/node`, `@agentgauge/core` (transitively), `openai` peer/dependency
**Must NOT:**

- Push OpenAI-specific types into `@agentgauge/core`
- Call the ingestion API directly (use the Node client)
- Import from `apps/*`

OpenAI concepts (e.g. Chat Completions response shapes) stay inside this package and are mapped to universal telemetry fields.

---

## Application Responsibilities

### `apps/api`

Cloud ingestion and query API.

- `POST /v1/traces` (MVP ingestion)
- Authentication via API keys
- Request validation, payload-size limits, rate limiting
- Persistence handoff (direct write and/or queue to worker)
- Future query endpoints (`/v1/usage`, `/v1/agents`, `/v1/traces`, `/v1/costs`, …)

May consume shared types from `@agentgauge/core` for validation alignment. Must not import SDK transport internals from `@agentgauge/node` as a runtime dependency of the API process unless a deliberate shared library is extracted later.

### `apps/worker`

Asynchronous telemetry processing.

- Consume ingested events
- Authoritative cost estimation using server-side pricing data
- Aggregation / enrichment jobs as needed
- Reliable writes to PostgreSQL

### `apps/dashboard`

Human-facing UI.

- Overview, agents, traces, usage analytics
- API-key management UX
- Talks to the API only; no direct database access from the browser

---

## Dependency Direction

Desired package dependency model:

```text
@agentgauge/core
        ↑
@agentgauge/node
        ↑
@agentgauge/openai
```

Application dependency guidance:

```text
apps/api        →  @agentgauge/core   (schemas / shared types)
apps/worker     →  @agentgauge/core
apps/dashboard  →  API HTTP contract (not SDK packages, except possibly shared types)
examples/*      →  @agentgauge/node and/or @agentgauge/openai
```

### Hard rules

1. **Packages never import from `apps/`.**
2. **`core` never imports from `node` or provider packages.**
3. **`node` never imports from provider packages** (`openai`, future `anthropic`, etc.).
4. **Provider packages never import sibling provider packages.**
5. **Provider-specific types do not leak into `core`.**
6. **Dashboard does not embed ingestion or worker logic.**
7. **Cost pricing tables live on the server** (worker/API), not as a permanent mandatory dependency of the client SDK. See [ADR-004](./DECISIONS.md#adr-004-cost-calculation-belongs-primarily-on-the-server).

---

## Architecture Boundary Rules

### Telemetry safety

- SDK public APIs that wrap provider calls must propagate the provider result/error to the caller unchanged in semantics.
- Side effects (recording, enqueue, HTTP flush) run in a best-effort path: failures are swallowed or logged locally, never rethrown into the customer request path unless the developer explicitly opts into a strict debug mode (not default).

### I/O vs pure logic

- Put schemas, mapping, and cost math (when pure) in testable modules without network I/O.
- Isolate HTTP, timers, and filesystem behind narrow interfaces for testing.

### Configuration

- Prefer explicit client options; support environment variables as conveniences.
- Do not rely on hidden global singletons for production configuration. If a default client exists for DX, document it and keep it overrideable.

### Versioning alignment

- Early development uses synchronized versions across `@agentgauge/*` packages. See [VERSIONING_AND_RELEASES.md](./VERSIONING_AND_RELEASES.md).

### Documentation sync

- Any new public export or HTTP endpoint requires documentation updates in the same change set.

---

## Data Flow (Happy Path)

1. Application invokes instrumented OpenAI call or manual trace API.
2. `@agentgauge/openai` or manual API builds a `TraceEvent` using `@agentgauge/core` shapes.
3. `@agentgauge/node` enqueues the event; batches and flushes via HTTP transport.
4. `apps/api` authenticates, validates, and accepts the batch.
5. `apps/worker` (or API path) persists and computes estimated cost.
6. Dashboard / query API reads aggregated and trace-level data.

Failure at steps 3–5 must not fail the application’s LLM call at step 1.

---

## Explicit Non-Architecture (for now)

Do not introduce yet:

- Multi-region event bus topologies
- Full OpenTelemetry Collector pipelines as a hard dependency
- Plugin marketplaces
- Shared micro-frontend frameworks
- Premature multi-tenant control planes beyond org/project needs for MVP

---

## Related Documents

- [CODING_STANDARDS.md](./CODING_STANDARDS.md)
- [API_DESIGN.md](./API_DESIGN.md)
- [MILESTONES.md](./MILESTONES.md)
- [SECURITY.md](./SECURITY.md)
