# Contributing to AgentGauge

Thank you for contributing. AgentGauge is an early-stage open-source project; **scope discipline** matters as much as code quality.

**Related:** [CODING_STANDARDS.md](./CODING_STANDARDS.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [TESTING_STRATEGY.md](./TESTING_STRATEGY.md), [MILESTONES.md](./MILESTONES.md)

---

## Before You Start

1. Read [PRODUCT_SCOPE.md](./PRODUCT_SCOPE.md) and [MILESTONES.md](./MILESTONES.md)
2. Confirm your change fits the **current** milestone
3. For architectural changes, propose an entry in [DECISIONS.md](./DECISIONS.md)

---

## Install (Target Workflow)

Exact scripts:

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

| Branch | Purpose |
|--------|---------|
| `main` | Stable development line |
| `feat/<short-name>` | Features |
| `fix/<short-name>` | Bug fixes |
| `docs/<short-name>` | Documentation |
| `chore/<short-name>` | Tooling / maintenance |

Keep branches short-lived and focused.

---

## Development Commands (Target)

Once the monorepo exists, expect commands similar to:

```bash
pnpm build
pnpm test
pnpm lint
pnpm format
pnpm typecheck
```

Package-scoped filters (illustrative):

```bash
pnpm --filter @agentgauge/core test
pnpm --filter @agentgauge/node test
```

Use the repo scripts as source of truth when they exist.

---

## Testing

- Add tests for behavioral changes ([TESTING_STRATEGY.md](./TESTING_STRATEGY.md))
- Do not call real paid LLM APIs in tests
- Include failure paths for transport, validation, and adapter mapping when relevant
- Run the affected suite before opening a PR

---

## Linting & Formatting

- Follow the repo ESLint/Prettier (or equivalent) config once present
- Do not disable rules broadly to land a PR
- Format generated diffs so reviews stay readable

---

## Build

- All affected packages must typecheck and build
- Do not commit build artifacts unless the project explicitly decides to

---

## Versioning / Changesets

Early development uses **synchronized fixed versions** across `@agentgauge/*` packages.

- Prefer Changesets (`pnpm changeset`) — packages are fixed/synchronized via `.changeset/config.json`
- Do not manually publish from a fork without maintainer approval
- See [VERSIONING_AND_RELEASES.md](./VERSIONING_AND_RELEASES.md)

---

## Pull Request Expectations

PRs should:

1. State the milestone and motivation
2. Stay narrowly scoped
3. Include tests for code changes
4. Update docs when public behavior changes
5. Respect architecture boundaries (no `apps` → packages reverse imports; no provider types in `core`)
6. Pass CI

PR description template (suggested):

```markdown
## Milestone
e.g. Milestone 1

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
- Update [TELEMETRY_SPEC.md](./TELEMETRY_SPEC.md) / [API_DESIGN.md](./API_DESIGN.md) when contracts change

---

## Architecture-Boundary Expectations

Reviewers will reject changes that:

- Import `apps/*` from `packages/*`
- Add Node/provider dependencies to `@agentgauge/core`
- Leak OpenAI types into `core`
- Make telemetry failures fail customer LLM calls by default
- Capture prompts/completions by default

---

## Security

Follow [SECURITY.md](./SECURITY.md). Never paste real API keys into issues, PRs, or fixtures.

---

## Code of Conduct

Be respectful and constructive. Maintainers may decline out-of-scope contributions politely and redirect them to a future milestone.

---

## License

AgentGauge is licensed under the [Apache License 2.0](../LICENSE). Contributions are offered under the same license.
