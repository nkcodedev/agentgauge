# AgentGauge Milestones

**Status:** Roadmap for early development
**Related:** [PRODUCT_SCOPE.md](./PRODUCT_SCOPE.md), [VERSIONING_AND_RELEASES.md](./VERSIONING_AND_RELEASES.md), [ARCHITECTURE.md](./ARCHITECTURE.md)

AgentGauge ships **milestone-by-milestone** with strict scope control. Do not pull future milestone work into the current one.

---

## Overview

| Milestone | Version | Theme |
|-----------|---------|-------|
| 1 | `0.1.0` | Core SDK |
| 2 | `0.2.0` | OpenAI Observability |
| 3 | `0.3.0` | Cloud Telemetry |
| 4 | `0.4.0` | Public MVP |
| 5+ | `0.5.0+` | Post-MVP (outline only) |

Public MVP ≈ Milestone 4. Earlier milestones are incremental, releasable slices.

---

## Milestone 1 — Core SDK

**Target release:** `0.1.0`

### Deliver

- Monorepo foundation (pnpm, TypeScript ESM, workspace layout)
- `@agentgauge/core` — trace/usage/provider contracts, validation, shared errors
- `@agentgauge/node` — client, trace lifecycle, custom transport, HTTP transport foundation
- Batching / flush / shutdown fundamentals (as needed for a credible SDK)
- Unit/integration tests for core + node
- At least one runnable example (manual tracing)
- Root README accuracy for what works
- npm publication readiness (packaging, license, changelog start)

### Explicitly not in Milestone 1

- `@agentgauge/openai`
- Cloud API / worker / dashboard
- Cost estimation pipeline
- Provider auto-instrumentation

### Exit criteria

- Packages build and test cleanly ✅ (0.1.0)
- Example demonstrates manual trace emission via a transport ✅
- Docs match implemented behavior ✅
- Architecture boundaries respected ✅

**Status:** Complete for `0.1.0` (implementation present; npm publish deferred).

---

## Milestone 2 — OpenAI Observability

**Target release:** `0.2.0`

### Deliver

- `@agentgauge/openai`
- Automatic OpenAI telemetry for supported SDK calls
- Token extraction from provider usage fields
- Latency measurement
- Provider / model detection
- Error capture (sanitized)
- Batching improvements informed by real instrumentation
- Tests with mocked OpenAI responses (no paid CI calls)
- Example using `observeOpenAI(...)` style DX

### Explicitly not in Milestone 2

- Anthropic / Gemini packages
- Hosted ingestion persistence
- Dashboard UI
- Budgets / alerts

### Exit criteria

- Instrumenting OpenAI produces valid `TraceEvent`s ✅
- Customer OpenAI calls succeed even if telemetry transport fails ✅
- Docs for OpenAI package published ✅

**Status:** Complete for `0.2.0` (implementation present; npm publish deferred).

---

## Milestone 3 — Cloud Telemetry

**Target release:** `0.3.0`

### Deliver

- `apps/api` ingestion: `POST /v1/traces`
- API-key authentication
- PostgreSQL persistence
- Project / environment support end-to-end
- Pricing model + **estimated** cost calculation (server/worker authoritative)
- `apps/worker` (or equivalent processing path) for reliable enrichment/persistence
- Reliable telemetry delivery semantics (retries, basic dedupe as designed)
- Integration tests for auth, ingest, persistence, cost enrichment

### Explicitly not in Milestone 3

- Full polished public dashboard (may have minimal internal/debug views only if needed)
- Multi-provider support beyond OpenAI
- Governance / security product features

### Exit criteria

- SDK can send events to hosted/local API with API key
- Events queryable at the data layer (even if UI is minimal)
- Estimated costs stored for known pricing entries
- Security basics: TLS in hosted env, validation, rate/size limits

---

## Milestone 4 — Public MVP

**Target release:** `0.4.0`

### Deliver

- Overview dashboard
- Agents views
- Traces exploration
- Usage analytics
- API-key management UI
- Metadata / tags visible where appropriate
- Documentation polish for public early adopters
- Public MVP readiness checklist (stability caveats still allowed on `0.x`)

### Explicitly not in Milestone 4

- Advanced governance / policy engines
- Agent security controls productization
- Budgets and alerts (unless a thin stub is explicitly approved — default **no**)
- Deep tool-call graph tracing

### Exit criteria

- New TypeScript developer can instrument OpenAI, send telemetry, and view usage/cost signals in the dashboard
- README clearly states supported features vs roadmap
- Milestone 1–4 docs aligned with reality

---

## Future Milestones (Outline Only)

Do **not** fully design these now. Potential later themes:

| Theme | Examples |
|-------|----------|
| More providers | Anthropic, Gemini |
| FinOps | Budgets, alerts |
| Deeper tracing | Tool calls, multi-step agent graphs |
| Governance | Policy controls |
| Security product | Agent security controls |
| Platform | Additional languages, retention controls, SSO |

Each requires its own milestone brief before implementation.

---

## Scope Control Rules

1. PRs must map to the **current** milestone unless they are docs/chore fixes.
2. “While we’re here” features from future milestones are rejected in review.
3. New ADRs required for architecture changes that affect multiple milestones.
4. Every milestone includes tests and documentation updates.

---

## Suggested Sequencing After Docs

**Next implementation task:** begin **Milestone 1 — Core SDK** foundation (monorepo + `@agentgauge/core` + `@agentgauge/node`), as detailed at the end of the documentation kickoff summary — not before docs are accepted.
