# AgentGauge Product Scope

**Status:** Milestone 3 (`0.3.0`) — cloud telemetry + cost intelligence (no dashboard)
**Audience:** Maintainers, contributors, and early adopters evaluating the project

This document defines what AgentGauge is, who it serves, what ships in the MVP, and what is explicitly deferred. Scope control is mandatory: features outside the current milestone must not be implemented early.

---

## What AgentGauge Is

AgentGauge is an **AI agent observability and cost-intelligence platform** for developers building and operating AI agents.

It helps teams answer:

- Which agents are running, and how often?
- Which providers and models are used?
- How many tokens are consumed, and at what estimated cost?
- Where do latency and errors concentrate?
- How does usage vary by project and environment?

Through `0.3.0`, AgentGauge ships a TypeScript SDK plus a self-hostable ingestion/query API with PostgreSQL-backed cost estimation. The dashboard UI arrives in Milestone 4.

---

## Problem Statement

AI agent applications are proliferating, but operational visibility is weak:

1. **Opaque cost** — Token usage and spend are scattered across provider dashboards, logs, and ad-hoc scripts.
2. **Fragile observability** — Teams reinvent tracing around provider SDKs without shared schemas or privacy defaults.
3. **Agent-level blind spots** — Provider tools track API calls; they rarely organize telemetry by *agent identity*, project, or environment.
4. **Integration friction** — Existing observability stacks are heavy or require capturing sensitive prompt content by default.

AgentGauge addresses these gaps with a small SDK, privacy-first defaults, and cost-aware telemetry designed for agent workloads.

---

## Target Users

### Primary

- **Node.js / TypeScript developers** building AI agents, copilots, or LLM-backed services
- **Platform / infra engineers** adding observability to multiple agent services
- **Engineering leads** who need cost and reliability signals without adopting a large APM stack

### Secondary (later)

- Security / governance teams (post-MVP)
- Finance / FinOps stakeholders consuming cost reports (dashboard-era)

---

## Primary Use Cases (MVP)

| Use case | Description |
|----------|-------------|
| Manual tracing | Developers start/end traces and attach agent, project, environment, metadata, and tags |
| OpenAI auto-instrumentation | Wrap the OpenAI client; AgentGauge captures model, tokens, latency, and errors automatically |
| Token & latency tracking | Record input/output/total tokens and end-to-end operation latency |
| Error visibility | Capture failure status and safe error metadata without leaking secrets |
| Cloud ingestion | Ship telemetry to AgentGauge via authenticated HTTP |
| Cost estimation | Server-side estimated cost from provider/model/token usage |
| Dashboard analytics | Explore agents, traces, usage, and estimated costs |

---

## Product Positioning

AgentGauge is **observability and cost intelligence for AI agents**, not a general-purpose APM, LLM gateway, or prompt store.

| AgentGauge **is** | AgentGauge **is not** |
|--------------------|------------------------|
| Agent-centric telemetry | A replacement for OpenTelemetry APM |
| Token + latency + error + cost signals | A model router or LLM proxy |
| Privacy-first by default | A prompt logging / training-data product |
| Lightweight TypeScript-first SDK | A multi-language platform on day one |
| Milestone-driven open source | An all-in-one AI governance suite (yet) |

---

## System Components

AgentGauge is deliberately split into components with clear boundaries. MVP delivery spans these components across milestones; not all ship in the first release.

### 1. AgentGauge SDK

**Packages:** `@agentgauge/core`, `@agentgauge/node`, and provider packages (e.g. `@agentgauge/openai`)

- Captures telemetry in the customer application
- Provides manual tracing APIs and automatic provider instrumentation
- Transports events to the ingestion API (or a custom transport)
- Must remain lightweight, best-effort, and non-blocking for customer AI calls

### 2. AgentGauge Ingestion API (`apps/api`)

- Accepts authenticated telemetry (`POST /v1/traces`)
- Validates payloads, enforces size/rate limits
- Persists or enqueues events for processing
- Eventually exposes query endpoints for usage, agents, traces, and costs

### 3. AgentGauge Worker (`apps/worker`)

- Asynchronous processing of ingested telemetry
- Enrichment such as **authoritative cost estimation**
- Durable writes and any deferred aggregation work

### 4. AgentGauge Dashboard (`apps/dashboard`)

- Human-facing UI for overview, agents, traces, usage, and API-key management
- Consumes query APIs; does not embed SDK runtime logic

### 5. Provider Integrations

- Provider-specific packages (starting with OpenAI)
- Extract provider/model/token/latency/error fields
- Emit standardized telemetry through the Node SDK
- Must **not** leak provider-specific types into `@agentgauge/core`

---

## MVP Scope

The public MVP corresponds to **Milestone 4 (`0.4.0`)**. Earlier milestones deliver slices of this scope.

### In scope for MVP

| Area | Detail |
|------|--------|
| Runtime | TypeScript / Node.js |
| Tracing | Manual trace lifecycle |
| Providers | OpenAI automatic instrumentation |
| Signals | Tokens, latency, success/error, timestamps |
| Context | Agent identity, project, environment, metadata, tags |
| Delivery | Cloud ingestion with API-key auth |
| Cost | Estimated cost calculation (primarily server-side) |
| UI | Overview dashboard, agents, traces, usage analytics, API-key management |
| Docs | Public documentation sufficient for early adopters |

### MVP product surface (conceptual)

```ts
import OpenAI from "openai";
import { observeOpenAI } from "@agentgauge/openai";

const openai = observeOpenAI(new OpenAI(), {
  agentId: "support-agent",
});
```

Developers should configure once; AgentGauge should infer provider, model, tokens, and latency where possible.

---

## Explicitly Out of Scope (MVP)

Do **not** implement the following before they are scheduled in a post-MVP milestone:

- Anthropic / Gemini / other provider integrations (beyond OpenAI)
- Budgets and spend alerts
- Tool-call / multi-step agent graph tracing (beyond simple operation traces)
- Governance and policy controls
- AI agent security controls / prompt injection defenses
- Model routing, fallbacks, or gateway behavior
- Capturing raw prompts/completions by default
- Collecting customer provider API keys
- Multi-language SDKs (Python, Go, etc.)
- Full OpenTelemetry compatibility as a hard requirement
- Enterprise SSO, RBAC hierarchy beyond org/project boundaries needed for MVP
- Real-time streaming analytics platforms
- On-prem / air-gapped enterprise packaging as a first-class product line

---

## Future Roadmap Boundaries

Post-MVP work may include (in rough priority order, subject to change):

1. Additional providers (Anthropic, Gemini, …)
2. Budgets and alerts
3. Richer tool-call and multi-span tracing
4. Optional (explicit) content capture with strong privacy controls
5. Governance / policy hooks
6. Security-oriented controls
7. Broader language SDKs

These items must remain **roadmap mentions only** until their own milestones are defined. Do not design full schemas or UIs for them during MVP work.

---

## Design Philosophy

1. **Never break the customer app** — Telemetry is best-effort; transport failures must not fail AI requests.
2. **Tiny integration surface** — Prefer one-liner instrumentation over invasive wrappers.
3. **Provider-neutral core** — Universal concepts in `core`; provider details in provider packages.
4. **Privacy-first defaults** — Operational metadata first; no prompt/completion capture by default.
5. **Lightweight SDK** — Minimal dependencies; low latency and memory overhead.
6. **Extensible without premature abstraction** — Extension points only when a milestone requires them.
7. **Tests are part of Done** — No milestone ships without appropriate tests.
8. **Documentation is part of the product** — Public behavior must be documented.

---

## Developer Experience Goals

- Install one or two packages and instrument in minutes
- Sensible defaults for project/environment via configuration or env vars
- Predictable TypeScript types and errors
- Clear flush/shutdown behavior for serverless and long-running processes
- Examples that match real Node.js apps
- Docs that state what works *now*, not what is planned

---

## Non-Goals

- Becoming a general distributed-tracing competitor
- Storing full conversational transcripts by default
- Acting as a proxy between the app and the LLM provider
- Guaranteeing exact billing parity with provider invoices in V1 (estimates only)
- Supporting every LLM SDK on day one
- Perfect 100% test coverage as a vanity metric

---

## Related Documents

- [ARCHITECTURE.md](./ARCHITECTURE.md) — component boundaries and dependency rules
- [MILESTONES.md](./MILESTONES.md) — delivery order
- [TELEMETRY_SPEC.md](./TELEMETRY_SPEC.md) — event contract
- [SECURITY.md](./SECURITY.md) — privacy and security principles
- [DECISIONS.md](./DECISIONS.md) — architecture decision records
