# AgentGauge Testing Strategy

**Status:** Binding testing philosophy
**Related:** [CODING_STANDARDS.md](./CODING_STANDARDS.md), [MILESTONES.md](./MILESTONES.md), [SECURITY.md](./SECURITY.md)

AgentGauge aims for **high confidence without meaningless coverage chasing**. Tests prove behavior that users and operators rely on. Arbitrary 100% line coverage is not a goal.

---

## Milestone 3 integration / database / E2E

Requires local PostgreSQL (`docker compose up -d`):

| Layer | Location | Covers |
|-------|----------|--------|
| Unit | `apps/api/src/lib/*.test.ts`, `packages/db/src/pricing.test.ts` | keys, schema, rate limit, cost math |
| Integration | `apps/api/src/api.integration.test.ts` | auth, ingest, isolation, usage, pagination, batch |
| Database | `packages/db/src/database.integration.test.ts` | constraints, FKs, enrich, cascades |
| E2E | `apps/api/src/e2e.sdk.test.ts` | SDK → HTTP → API → DB → usage |

Do not mock away PostgreSQL for these suites. Do not call live OpenAI.

---

## Milestone 4 dashboard tests

| Layer | Location |
|-------|----------|
| Unit/component | `apps/dashboard/src/**/*.test.ts(x)` |
| API key management | `apps/api/src/api-keys.integration.test.ts` |
| Playwright (optional) | `apps/dashboard/e2e` via `pnpm --filter @agentgauge/dashboard test:e2e` |

Playwright requires browsers installed and running API+dashboard. If browsers are unavailable, report transparently — do not claim E2E passed.

---

## Principles

1. **Deterministic** — Same inputs produce the same results; no flaky time/network dependence without fakes.
2. **No paid LLM calls in normal CI** — Mock provider HTTP/SDK responses.
3. **Test success and failure** — Including malformed payloads, timeouts, transport failures, and shutdown/flush.
4. **Prefer behavioral tests** — Assert observable outcomes over internal private state when possible.
5. **Milestone gating** — A milestone is not done without the tests listed for that milestone.
6. **Privacy in fixtures** — Test data must not include real secrets or production prompts.

---

## Testing Layers

### Unit tests

Fast, isolated tests for pure and near-pure logic.

**Cover:**

- Schemas and validation
- Token / usage transformations
- Trace lifecycle state transitions
- Configuration parsing and defaults
- Batching logic (size, interval, overflow)
- Transport request shaping (without real network, via mocks)
- Cost calculations (server-side pure functions)
- Provider adapters’ mapping from provider responses → `TraceEvent` fields

**Characteristics:**

- No real network
- No real database
- Fake timers when testing intervals/flush

---

### Integration tests

Verify seams between components.

**Cover:**

| Seam | Intent |
|------|--------|
| SDK → transport | Client batches and calls transport with expected payloads |
| OpenAI adapter → AgentGauge event | Wrapped calls produce correct telemetry fields |
| Ingestion API → persistence | Accepted events land in DB or queue as designed |
| API authentication | Valid/invalid/missing API keys |
| Worker processing | Cost enrichment and write path |

**Characteristics:**

- May use ephemeral local Postgres or testcontainers when apps exist
- Still mock external LLM provider APIs
- Prefer black-box assertions at module boundaries

---

### End-to-end tests

Eventually validate the full path:

```text
Example AI app
  → AgentGauge SDK
  → ingestion API
  → processing
  → database
  → dashboard / query API
```

**Rules:**

- Introduced when Milestone 3+ surfaces exist; not required for Milestone 1 beyond an example + unit/integration coverage
- Still avoid real paid LLM calls; use mocked OpenAI or recorded fixtures
- Dashboard UI E2E (Playwright) only when the dashboard is in scope and critical flows exist

---

## Required Failure Scenarios

Every relevant component should eventually cover:

| Scenario | Why |
|----------|-----|
| Success path | Baseline correctness |
| Provider error responses | Status/error fields populate safely |
| Malformed provider payloads | Adapter does not throw into customer path unexpectedly; telemetry may be partial |
| Timeouts | Latency/error recording; customer call semantics preserved |
| Transport failure | Telemetry drop/retry; customer call still succeeds |
| Shutdown / flush | Buffered events attempt delivery; process exit hooks behave |
| Auth failure (API) | Clear error, no data leak |
| Oversized payload (API) | Rejected with standard error |

---

## Tooling

| Layer | Tool | Notes |
|-------|------|------|
| Unit / integration (TS) | **Vitest** | Default for packages and Node apps |
| HTTP mocking | Vitest mocks / `undici` MockAgent / similar | Choose in Milestone 1 and document |
| DB integration | Test DB or containers | When `apps/api` / `worker` exist |
| Dashboard E2E | **Playwright** (later) | Only if UI critical paths need it |
| Coverage reports | Vitest coverage (e.g. v8) | Track trends; do not gate on 100% |

Do not add duplicate test frameworks in the same package without a strong reason.

---

## Coverage Expectations

| Area | Expectation |
|------|-------------|
| Critical business logic (schemas, mapping, batching, cost math, auth) | Near-complete **behavioral** coverage |
| Thin glue / wiring | Smoke / integration coverage; not every line |
| UI styling | Not coverage-driven |
| Generated or trivial re-exports | Ignore or exclude |

**Policy:** Pull requests that change critical logic without tests should be rejected. Coverage percentage alone is neither necessary nor sufficient.

---

## CI Expectations

When CI exists:

- Run unit tests on every PR
- Run package integration tests on every PR
- Run heavier API/worker integration tests on every PR once introduced (optimize later if slow)
- Fail on flaky tests — fix or quarantine with an issue, do not ignore silently
- Cache dependencies via pnpm

---

## Test Data & Fixtures

- Use synthetic API keys shaped like production formats but clearly fake (`ag_test_…`)
- Provider fixtures should look realistic but contain no sensitive user content
- Prefer shared fixture builders over copy-pasted giant JSON blobs when patterns repeat
- Colocate unit/integration tests as `*.test.ts` next to source (Milestone 1)
- Provider adapter tests must mock OpenAI; never call paid APIs in CI
- Assert original provider errors/results are preserved when telemetry fails

---

## Performance & Overhead Tests

Not required for Milestone 1. Later, consider lightweight benchmarks ensuring instrumentation overhead stays minimal. Do not block early milestones on elaborate perf harnesses.

---

## Definition of Done (Testing)

A change is done when:

1. Automated tests cover new/changed behavior and important failure paths
2. Tests pass locally and in CI (when CI exists)
3. No real external paid APIs are required to run the suite
4. Docs updated if public behavior changed

---

## Related Documents

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [TELEMETRY_SPEC.md](./TELEMETRY_SPEC.md)
- [API_DESIGN.md](./API_DESIGN.md)
