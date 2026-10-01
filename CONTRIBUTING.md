# Contributing to AgentGauge

Thank you for contributing. AgentGauge is an early-stage open-source project; **scope discipline** matters as much as code quality.

**Related:** [ARCHITECTURE.md](./docs/ARCHITECTURE.md), [SECURITY.md](./SECURITY.md), [API.md](./docs/API.md), [TELEMETRY.md](./docs/TELEMETRY.md)

---

## Before You Start

1. Confirm your change fits current public product behavior (see [README.md](./README.md) and [CHANGELOG.md](./CHANGELOG.md))
2. Prefer small, focused PRs over large speculative refactors
3. Discuss architectural changes in a GitHub issue before large redesigns

---

## Install

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm typecheck
pnpm format:check
pnpm check
```

Do not introduce npm/yarn lockfiles. pnpm is mandatory.

---

## Branch Conventions

| Branch               | Purpose                 |
| -------------------- | ----------------------- |
| `main`               | Stable development line |
| `feat/<short-name>`  | Features                |
| `fix/<short-name>`   | Bug fixes               |
| `docs/<short-name>`  | Documentation           |
| `chore/<short-name>` | Tooling / maintenance   |

Keep branches short-lived and focused.

---

## Development Commands

```bash
pnpm build
pnpm test
pnpm lint
pnpm format
pnpm typecheck
```

Package-scoped filters:

```bash
pnpm --filter @agentgauge/core test
pnpm --filter @agentgauge/node test
```

---

## Testing

- Add tests for behavioral changes
- Do not call real paid LLM APIs in tests
- Include failure paths for transport, validation, and adapter mapping when relevant
- Run the affected suite before opening a PR
- Integration, database, and dashboard E2E tests expect a reachable PostgreSQL instance (see `docker-compose.yml`)

---

## Linting & Formatting

- Follow the repo ESLint/Prettier config
- Do not disable rules broadly to land a PR
- Format generated diffs so reviews stay readable

---

## Build

- All affected packages must typecheck and build
- Do not commit build artifacts

---

## Versioning

Early development uses **synchronized fixed versions** across `@agentgauge/*` packages.

- Prefer Changesets (`pnpm changeset`) — packages are fixed/synchronized via `.changeset/config.json`
- Do not manually publish from a fork without maintainer approval

---

## Pull Request Expectations

PRs should:

1. State motivation clearly
2. Stay narrowly scoped
3. Include tests for code changes
4. Update docs when public behavior changes
5. Respect architecture boundaries (no `apps` → packages reverse imports; no provider types in `core`)
6. Pass CI

PR description template (suggested):

```markdown
## Summary

What and why

## Test plan

- [ ] unit/integration steps
```

---

## Commit Expectations

- Prefer clear, imperative subject lines: `add http transport retry backoff`
- Keep commits focused; avoid mixing unrelated refactors
- Do not commit secrets, `.env` files, or credentials

---

## Documentation Requirements

- Public APIs, env vars, and HTTP endpoints must be documented
- Do not claim unimplemented features in README
- Update [docs/TELEMETRY.md](./docs/TELEMETRY.md) / [docs/API.md](./docs/API.md) when contracts change

---

## Architecture-Boundary Expectations

Reviewers will reject changes that:

- Import `apps/*` from `packages/*`
- Add Node/provider dependencies to `@agentgauge/core`
- Leak OpenAI types into `core`
- Make telemetry failures fail customer LLM calls by default
- Capture prompts/completions by default

Enforced by `scripts/check-boundaries.mjs`.

---

## Security

Follow [SECURITY.md](./SECURITY.md). Never paste real API keys into issues, PRs, or fixtures.

---

## Code of Conduct

Be respectful and constructive. Maintainers may decline out-of-scope contributions politely.

---

## License

AgentGauge is licensed under the [Apache License 2.0](./LICENSE). Contributions are offered under the same license.
