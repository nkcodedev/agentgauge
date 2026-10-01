# Architecture Decision Records

This log captures significant AgentGauge decisions. New ADRs should be appended with an incremented ID.

**Format:** Title, Status, Context, Decision, Consequences

---

## ADR-001: TypeScript-first SDK

**Status:** Accepted

### Context

AgentGauge’s initial audience is Node.js/TypeScript developers building AI agents. A shared type system improves SDK safety and documentation fidelity.

### Decision

Implement first-party SDKs and shared contracts in **TypeScript** with strict typing. Other languages may come later as separate milestones.

### Consequences

- Strong editor UX and compile-time contracts
- Monorepo tooling centered on TS/pnpm
- Non-TS ecosystems wait for future milestones

---

## ADR-002: pnpm monorepo

**Status:** Accepted

### Context

AgentGauge needs multiple packages (`core`, `node`, provider adapters) and apps (`api`, `worker`, `dashboard`) with shared standards.

### Decision

Use a **pnpm workspace monorepo** with clear `packages/` and `apps/` boundaries.

### Consequences

- Consistent versioning and refactors across packages
- Contributors learn one repo layout
- Requires discipline to avoid illegal cross-imports (enforced by docs + review + later tooling)

---

## ADR-003: Separate provider integrations from core SDK

**Status:** Accepted

### Context

OpenAI is first, but AgentGauge must remain provider-neutral. Encoding OpenAI shapes in core would poison future Anthropic/Gemini support.

### Decision

Keep universal contracts in `@agentgauge/core`, runtime in `@agentgauge/node`, and provider-specific instrumentation in dedicated packages (e.g. `@agentgauge/openai`).

Dependency direction:

```text
core ← node ← openai
```

### Consequences

- Cleaner core and clearer ownership
- Slightly more packages to version/publish
- Mapping code lives at the edges (tested heavily)

---

## ADR-004: Cost calculation belongs primarily on the server

**Status:** Accepted

### Context

Model pricing changes often. Embedding authoritative pricing in every client SDK risks staleness, large dependency updates, and inconsistent estimates across SDK versions.

### Decision

Compute **authoritative estimated cost on the server** (API/worker) using server-side pricing data. Client SDKs send usage telemetry (tokens, provider, model). Optional client-side estimates, if ever added, are advisory only.

### Consequences

- SDKs stay lighter and more stable
- Cost accuracy improves without forcing SDK upgrades for price changes
- Offline-only users may not see costs until cloud processing exists (acceptable for MVP path)

---

## ADR-005: Telemetry collection must never break the customer's application

**Status:** Accepted

### Context

Observability libraries that throw on flush/network errors create production incidents and drive uninstalls.

### Decision

AgentGauge telemetry is **best-effort**. Failures in recording, batching, or transport must not fail the customer’s AI provider request by default. Instrumentation wrappers propagate provider success/failure unchanged.

### Consequences

- Possible silent telemetry loss (mitigate with debug logs, retries, metrics later)
- Implementation must carefully isolate side effects
- Tests must prove transport failure ≠ provider call failure

---

## ADR-006: Raw prompt/completion capture is disabled by default

**Status:** Accepted

### Context

Prompts and completions often contain PII, secrets, or confidential business data. Default capture would make AgentGauge unsafe for many teams.

### Decision

V1 collects operational metadata (tokens, model, latency, status, etc.). **Raw prompts and completions are not captured by default.** Any future content capture must be explicit opt-in and documented via a new ADR.

### Consequences

- Stronger privacy posture and easier adoption
- Debugging content-level issues requires customer logs or future opt-in features
- Metadata/tags remain a potential footgun — documented in SECURITY.md

---

## ADR-007: Use fixed package versions during early development

**Status:** Accepted

### Context

Independent SemVer per package is powerful but confusing while APIs churn rapidly and packages are tightly coupled.

### Decision

During early development (`0.x`), publish `@agentgauge/core`, `@agentgauge/node`, and provider packages with **synchronized versions** (e.g. all `0.2.0`).

### Consequences

- Simpler mental model and release process
- Some packages bump without code changes
- May revisit independent versioning after `1.0.0`

---

## ADR-008: Milestone 1 tooling stack

**Status:** Accepted

### Context

Milestone 1 required concrete choices for monorepo orchestration, builds, tests, formatting, IDs, timestamps, and releases.

### Decision

- **pnpm** workspaces + **Turborepo** (minimal pipeline)
- **tsup** for ESM + `.d.ts` + source maps
- **Vitest** with colocated `*.test.ts`
- **ESLint** + **Prettier** at repo root
- **Changesets** with `fixed: ["@agentgauge/*"]`
- IDs via `crypto.randomUUID()`
- Public timestamps as ISO-8601 UTC strings; latency via `process.hrtime.bigint()` in `@agentgauge/node`

### Consequences

- Fast local DX aligned with modern TS libraries
- Core remains free of Node-specific timing/ID generation beyond what consumers inject; Node SDK owns runtime generation

---

## ADR-009: TraceEvent nested shape and status vocabulary

**Status:** Accepted

### Context

Early docs used flat token fields, `startTime`/`endTime`, `sdkName`/`sdkVersion`, and status `"ok"`. Milestone 1 implementation preferred a nested, clearer public shape.

### Decision

Adopt:

- `status: "success" | "error"`
- `startedAt` / `endedAt` (ISO-8601 UTC strings)
- nested `usage` and `sdk`
- `error.name` (not `error.type`)
- `project` / `environment` optional at the SDK layer for `0.1.0` (cloud ingest may require them later)

### Consequences

- Docs updated in `TELEMETRY_SPEC.md`
- Cleaner TypeScript ergonomics
- Ingest API in Milestone 3 must accept this shape

---

## ADR-010: Duplicate trace completion and post-shutdown behavior

**Status:** Accepted

### Context

Need predictable behavior for SDK misuse vs delivery failure.

### Decision

- Calling `end()`/`fail()` twice throws `ConfigurationError` (SDK misuse)
- After `shutdown()`, `startTrace` / `end` / `fail` throw `ConfigurationError`
- Transport/delivery failures never throw into the customer path; optional `onTransportError` callback may observe them

### Consequences

- Misuse is visible during development
- Production AI calls remain insulated from telemetry outages

---

## ADR-011: Per-instance OpenAI client wrapping via Proxy

**Status:** Accepted

### Context

Milestone 2 needs automatic OpenAI telemetry without monkey-patching global SDK state or forcing AgentGauge-specific request APIs.

### Decision

`observeOpenAI(client, options)` returns a `Proxy` around the provided client instance that intercepts:

- `responses.create`
- `chat.completions.create`

Only the returned wrapper is instrumented. Other OpenAI clients remain untouched.

### Consequences

- Clear isolation between instrumented and plain clients
- Original method signatures and return values are preserved
- Deep wrapping of every OpenAI surface is avoided

---

## ADR-012: OpenAI streaming is unsupported for telemetry in 0.2.0

**Status:** Accepted

### Context

Correct streaming telemetry (token totals, final latency, safe finalization) requires more work than Milestone 2 scope allows.

### Decision

When `stream: true` is present, AgentGauge **passes the call through unchanged** and emits **no** telemetry. Behavior is documented and tested.

### Consequences

- Customer streaming is never broken by AgentGauge
- Streaming observability is deferred to a later milestone

---

## ADR-013: Provider packages use openai as a peer dependency

**Status:** Accepted

### Context

Apps already depend on a specific OpenAI SDK version. Bundling another copy risks duplicate clients and type conflicts.

### Decision

`@agentgauge/openai` declares `openai` as a **peerDependency** (`^4 || ^5 || ^6`) and depends on `@agentgauge/node` / `@agentgauge/core` normally.

### Consequences

- Developers install `openai` explicitly
- AgentGauge tracks a deliberate peer range in docs/README

---

## ADR-014: Preserve original OpenAI errors and responses

**Status:** Accepted

### Context

Customers must debug against the real OpenAI SDK contract. Wrapping errors in AgentGaugeError would break `instanceof` checks and status handling.

### Decision

- Successful OpenAI results are returned unchanged
- OpenAI failures are rethrown as the **same** error object after best-effort `trace.fail`
- AgentGauge transport failures never replace OpenAI results/errors

### Consequences

- Tests assert identity (`rejects.toBe(openaiError)`)
- Telemetry remains best-effort relative to the provider call

---

## ADR-015: API-key hashing uses SHA-256 (+ optional pepper)

**Status:** Accepted

### Context

AgentGauge API keys are high-entropy CSPRNG secrets (`ag_live_` / `ag_test_`). Slow password KDFs (bcrypt/argon2) add latency to every authenticated request without material benefit against offline guessing of 256-bit secrets.

### Decision

Store `SHA-256(pepper || ":" || plaintext)` as hex. Optional `AGENTGAUGE_API_KEY_PEPPER` strengthens server-side secrecy. Never store plaintext after creation.

### Consequences

- Fast auth lookups by unique `key_hash`
- Pepper rotation requires re-hashing or dual-verify windows (not implemented yet)
- Documented as unsuitable for low-entropy user passwords

---

## ADR-016: Drizzle ORM + PostgreSQL

**Status:** Accepted

### Context

Milestone 3 needs typed schema, deterministic migrations, and a lightweight Node/TS database layer.

### Decision

Use **PostgreSQL 16** with **Drizzle ORM** and SQL migrations under `packages/db/drizzle`. Private package `@agentgauge/db` owns schema/client/migrate/seed.

### Consequences

- No heavy enterprise ORM
- Apps share one schema package
- SDK packages must not depend on `@agentgauge/db`

---

## ADR-017: API key is the authoritative project identity

**Status:** Accepted

### Context

SDK events may include optional `project`. Allowing payload project to select the tenant would enable cross-project writes with a stolen or misconfigured key path.

### Decision

The authenticated API key’s `project_id` is authoritative. If `event.project` is present and ≠ project `slug`, reject with `400 project_mismatch`. `environment` remains event-level metadata.

### Consequences

- Strong tenant isolation
- SDK `project` is informational/validation for cloud mode

---

## ADR-018: eventId idempotency via unique constraint

**Status:** Accepted

### Context

SDKs may retry HTTP delivery. Duplicate inserts would inflate usage/cost.

### Decision

`traces.event_id` is globally unique. Duplicate ingest returns `202` with the event listed under `duplicates` and does not insert a second row.

### Consequences

- Simple, durable idempotency without Redis
- Clients should keep stable `eventId`s across retries

---

## ADR-019: Historical model pricing + stored costs

**Status:** Accepted

### Context

Provider prices change. Recomputing historical reports from the latest price table would rewrite the past.

### Decision

`model_pricing` rows use `effective_from` / `effective_to`. Cost is calculated at ingest using pricing valid at `started_at` and **stored** on the trace (`input_cost`, `output_cost`, `total_cost`, `currency`). Unknown models leave costs null (`cost_status=unknown_model`).

### Consequences

- Past reports remain explainable
- Seeded prices require maintenance; never invent prices for unknown models

---

## ADR-020: Decimal-safe cost arithmetic

**Status:** Accepted

### Context

Binary floating point is unsafe for money-like values.

### Decision

Store costs/prices as PostgreSQL `numeric`. Compute in TypeScript with scaled integer/`bigint` math and half-up rounding to **10** decimal places for stored costs.

### Consequences

- Deterministic unit tests for pricing
- Display layers may round further for UI later

---

## ADR-021: Worker polls pending cost_status

**Status:** Accepted

### Context

Preferred architecture is API → durable row → worker enrichment. Redis/Kafka is unnecessary for MVP.

### Decision

Ingest enriches cost **synchronously** and sets `cost_status`. Worker polls `cost_status='pending'` for backfill/recovery. No Redis.

### Consequences

- Usage queries work immediately after ingest
- Worker remains a real process with a durable queue table pattern

---

## ADR-022: Batch ingestion is all-or-nothing validation

**Status:** Accepted

### Context

Partial batch acceptance complicates client retry semantics.

### Decision

Validate the entire `{ events }` batch first. Any malformed event → `400` and zero inserts. Duplicates within an otherwise valid batch remain idempotent at the DB layer.

### Consequences

- Deterministic failure mode
- Max batch size 100

---

## ADR-023: Dashboard uses Next.js App Router

**Status:** Accepted

### Context

Milestone 4 needs a human-facing MVP UI with server components and a simple BFF.

### Decision

Implement `apps/dashboard` with **Next.js (App Router) + React + Tailwind CSS**. Charts use **recharts**.

### Consequences

- Fast local DX and SSR-friendly data loading
- Dashboard is not published to npm

---

## ADR-024: Dashboard auth via server-side project API key proxy

**Status:** Accepted

### Context

User login/OAuth is out of Milestone 4 scope, but the browser must not receive the project API key.

### Decision

Configure `AGENTGAUGE_API_KEY` / `AGENTGAUGE_API_URL` as **server-only** env vars. Dashboard server components call the API directly; browser mutations go through `/api/backend/v1/*` BFF routes that attach the key.

### Consequences

- Temporary auth model, documented as MVP
- No API key in client JS bundles when used correctly

---

## ADR-025: API-key management HTTP API

**Status:** Accepted

### Context

Dashboard settings need create/list/revoke without returning stored secrets.

### Decision

```text
GET  /v1/api-keys
POST /v1/api-keys          → 201 includes plaintext once
POST /v1/api-keys/:id/revoke
```

List responses expose prefix/metadata only — never `key_hash` or full key.

### Consequences

- Matches seed/dev creation semantics
- Revoked keys fail subsequent auth

---

## ADR-026: Usage time bucketing via interval query param

**Status:** Accepted

### Context

Overview charts need requests/cost/tokens over time without many new endpoints.

### Decision

Extend `GET /v1/usage` with optional `interval=hour|day`, returning `series[]` plus `activeAgents`.

### Consequences

- Single query surface for KPIs + charts
- Bucketing uses PostgreSQL `date_trunc`

---

## ADR template (for future entries)

```markdown
## ADR-XXX: Title

**Status:** Proposed | Accepted | Superseded by ADR-YYY

### Context
...

### Decision
...

### Consequences
...
```
