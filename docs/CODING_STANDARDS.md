# AgentGauge Coding Standards

**Status:** Binding for all AgentGauge packages and apps
**Related:** [ARCHITECTURE.md](./ARCHITECTURE.md), [TESTING_STRATEGY.md](./TESTING_STRATEGY.md), [CONTRIBUTING.md](./CONTRIBUTING.md)

These standards keep the codebase consistent, reviewable, and safe to evolve. Prefer readability over cleverness. Do not over-engineer abstractions before a milestone requires them.

---

## Language & Tooling

| Concern | Standard |
|---------|----------|
| Language | TypeScript |
| Type checking | Strict TypeScript (`strict: true` and related strict flags) |
| Modules | ESM |
| Package manager | pnpm |
| Structure | pnpm monorepo |
| Tests | Vitest (see testing strategy) |
| Lint / format | ESLint + Prettier (repo root) |

---

## Design Principles

1. **Clear public APIs** — Exports are intentional; avoid accidental deep imports becoming public contract.
2. **Minimal dependencies** — Justify every runtime dependency; prefer stdlib / existing packages.
3. **Immutable data where practical** — Prefer `readonly` types and non-mutating transforms for events and configs.
4. **Explicit error handling** — No silent `catch` without documented reason; SDK telemetry paths may swallow *transport* errors by design, but must still record locally when debug logging is enabled.
5. **No `any`** — Unless unavoidable; each use requires a short comment explaining why and a follow-up if temporary.
6. **Avoid unsafe assertions** — Prefer narrowing, type guards, and schema validation over `as` casts.
7. **No hidden global state** — Configuration should be injectable; document any carefully limited default client.
8. **Dependency injection where useful** — Especially for clocks, transports, and HTTP clients in tests.
9. **Small focused modules** — One primary responsibility per file/module.
10. **Separate pure logic from I/O** — Mapping and validation stay pure; network stays at the edges.

---

## Naming Conventions

| Kind | Convention | Examples |
|------|------------|----------|
| Exported classes / types / interfaces / enums | PascalCase | `TraceEvent`, `AgentGaugeClient` |
| Functions / methods / variables | camelCase | `startTrace`, `inputTokens` |
| True constants | UPPER_SNAKE_CASE | `DEFAULT_FLUSH_INTERVAL_MS` |
| Packages / directories | kebab-case | `packages/openai`, `apps/api` |
| Files | kebab-case preferred for modules | `trace-event.ts`, `http-transport.ts` |
| React components (dashboard) | PascalCase file names acceptable | `AgentsTable.tsx` |
| Env vars | UPPER_SNAKE_CASE with `AGENTGAUGE_` prefix | `AGENTGAUGE_API_KEY` |

---

## Public APIs

Every public export must have:

1. **Explicit types** — No implicit `any`; exported functions declare parameter and return types.
2. **Documentation** — TSDoc on public symbols describing purpose, important options, and error behavior.
3. **Tests** — Behavioral coverage for the public contract.
4. **Predictable errors** — Documented error classes / codes; no random `Error` strings as the long-term contract.
5. **Backwards compatibility consideration** — Additive changes preferred; breaking changes follow [VERSIONING_AND_RELEASES.md](./VERSIONING_AND_RELEASES.md).

### Example shape (illustrative, not implemented)

```ts
/**
 * Starts a new trace for the given agent operation.
 * Telemetry emission is best-effort and never throws for transport failures.
 */
export function startTrace(options: StartTraceOptions): TraceHandle;
```

---

## Imports

- Prefer explicit relative imports within a package; avoid deep cross-package internals.
- Cross-package imports go through the package’s public entrypoint only.
- Do not import from `apps/` inside `packages/`.
- Do not import provider packages from `@agentgauge/core` or `@agentgauge/node`.
- Group imports consistently (stdlib / external / internal) once lint rules exist; keep diffs readable.
- Avoid circular imports; if a cycle appears, extract shared types into `core` or a smaller module.

---

## Exports

- Each package defines a deliberate public API surface (`exports` in `package.json` when packages exist).
- Prefer named exports over default exports for library code.
- Do not export internal helpers “just in case.”
- Breaking renames of public exports require a version bump and changelog entry.

---

## Barrel Files

- Barrel files (`index.ts`) are allowed at package entrypoints.
- Avoid deep trees of barrels that re-export everything and hurt tree-shaking or create cycles.
- Internal folders should not need barrels unless they clarify a deliberate submodule API.

---

## File Naming

- Use kebab-case for TypeScript modules in packages: `http-transport.ts`.
- Colocate tests as `*.test.ts` next to source (Milestone 1 convention).
- Prefer obvious names (`cost-estimate.ts`) over clever abbreviations.

---

## Error Classes

- Define shared, typed errors in `@agentgauge/core` when they are part of the cross-package contract.
- Runtime/transport errors may live in `@agentgauge/node`.
- Error names end with `Error` (`ValidationError`, `TransportError`).
- Include machine-readable `code` strings where useful for API/SDK consumers.
- Never put API keys, tokens, or raw prompts into error messages.

---

## Configuration

- Favor an options object on the client constructor / factory.
- Environment variables are optional conveniences, not the only configuration path.
- Validate configuration early with clear errors.
- Document every supported env var in README / docs when introduced.

---

## Environment Variables

- Prefix with `AGENTGAUGE_`.
- Document default, required/optional status, and security sensitivity.
- Never commit `.env` files with secrets.
- Example names (illustrative): `AGENTGAUGE_API_KEY`, `AGENTGAUGE_BASE_URL`, `AGENTGAUGE_PROJECT`, `AGENTGAUGE_ENVIRONMENT`.

---

## Logging

- SDK default: quiet. Optional debug logging behind an explicit flag or env var.
- Never log API keys, provider keys, Authorization headers, or raw prompt/completion content.
- Prefer structured fields (event id, trace id, status) over free-form dumps of payloads.
- Server apps may use a standard logger; still redact secrets.

---

## Comments

- Prefer clear code over narrating comments.
- Comments explain *why*, invariants, or non-obvious tradeoffs.
- TSDoc is required for public APIs; inline comments are optional elsewhere.
- Do not leave commented-out code in main branches.

---

## TODOs

- Format: `// TODO(scope): actionable description`
- TODOs must be actionable and ideally linked to an issue/milestone.
- Do not use TODOs to smuggle out-of-scope features into the current milestone.
- `FIXME` indicates a known defect; do not ship critical FIXMEs in a release without changelog disclosure.

---

## Deprecated APIs

- Mark with `@deprecated` TSDoc and state the replacement.
- Keep deprecated APIs for at least one minor release during `0.x` when practical, or document immediate removal if pre-stability churn is expected.
- Remove only with changelog + version bump notes.

---

## TypeScript Strictness

Required posture:

- `strict` enabled
- Prefer `unknown` over `any` at boundaries; narrow with validators
- Avoid enums unless they provide clear value; const objects + union types are often enough
- Do not disable typechecking for convenience (`@ts-ignore` requires justification comment)

---

## Testing Expectations for Code Changes

- New logic → tests in the same PR
- Bug fixes → regression test when feasible
- See [TESTING_STRATEGY.md](./TESTING_STRATEGY.md)

---

## What Not To Do

- Speculative abstraction layers “for future providers” beyond thin interfaces needed now
- Copy-pasting OpenAI response types into `core`
- Introducing large utility frameworks without need
- Silent behavior changes to public APIs without docs/changelog
- Implementing out-of-milestone features “while we’re here”
