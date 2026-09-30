# Versioning and Releases

**Status:** Policy for early AgentGauge development
**Related:** [MILESTONES.md](./MILESTONES.md), [CONTRIBUTING.md](./CONTRIBUTING.md), [DECISIONS.md](./DECISIONS.md)

AgentGauge uses **Semantic Versioning** and expects frequent milestone releases during early development.

---

## Semantic Versioning

Given a version `MAJOR.MINOR.PATCH`:

- **MAJOR** — incompatible API changes
- **MINOR** — backwards-compatible functionality
- **PATCH** — backwards-compatible bug fixes

During initial development, packages remain on **`0.x.y`**:

```text
0.1.0
0.2.0
0.3.0
0.4.0
...
```

**Do not release `1.0.0`** until public SDK APIs are considered stable.

---

## Fixed / Synchronized Package Versions

Early development uses **synchronized versions** across AgentGauge npm packages ([ADR-007](./DECISIONS.md#adr-007-use-fixed-package-versions-during-early-development)):

```text
@agentgauge/core@0.2.0
@agentgauge/node@0.2.0
@agentgauge/openai@0.2.0
```

Rules:

- Milestone releases bump all published `@agentgauge/*` packages together even if some packages had no code changes (documentation/changelog note is enough)
- Apps under `apps/` are not necessarily npm-published; they follow the same conceptual milestone version in release notes
- Independent package versioning may be reconsidered after `1.0.0` via a new ADR

---

## Versioning Policy (0.x)

| Change type | Version impact (typical) |
|-------------|--------------------------|
| Milestone feature set | Minor bump (`0.N.0`) |
| Bug fix / small patch after a milestone | Patch (`0.N.P`) |
| Breaking SDK change before 1.0 | Minor bump with clear changelog **BREAKING** section (still 0.x) |
| Docs-only | Often no npm publish; if publish needed, patch |

Daily/near-daily milestone cadence is encouraged early; empty releases without meaningful change are discouraged.

---

## Changelog Requirements

- Maintain a root `CHANGELOG.md` (created when the first release process lands)
- Each release entry includes:
  - Version and date
  - Added / Changed / Fixed / Breaking sections as applicable
  - Milestone reference when relevant (e.g. “Milestone 2 — OpenAI Observability”)
- User-facing changes require changelog updates in the same PR when possible

---

## npm Publishing Process (Target)

Exact automation is implemented with Milestone 1 readiness. Expected flow:

1. Ensure CI is green (tests, lint, build)
2. Update versions (synchronized) via the chosen tool (Changesets or script — decide in Milestone 1)
3. Update `CHANGELOG.md`
4. Publish public packages to npm with provenance if available
5. Create Git tag `v0.N.P`
6. Create GitHub Release notes from changelog

Packages intended for publish:

- `@agentgauge/core`
- `@agentgauge/node`
- `@agentgauge/openai` (from Milestone 2)

---

## Git Tags

- Tags follow `vMAJOR.MINOR.PATCH` (e.g. `v0.1.0`)
- Tags are immutable pointers to release commits
- Do not move tags after publish

---

## Prerelease Strategy

Optional prereleases for risky changes:

```text
0.3.0-alpha.1
0.3.0-beta.1
0.3.0-rc.1
```

Rules:

- Prereleases may be published under npm dist-tags (`alpha`, `beta`, `next`)
- Default `latest` tag points only at stable milestone/patch releases
- Document known gaps in prerelease notes

---

## Breaking-Change Rules

Before `1.0.0`:

- Breaking changes allowed but must be labeled **BREAKING** in the changelog
- Prefer deprecation warnings when practical
- Communicate in README “early development” status

At `1.0.0` and after:

- Breaking changes require major bump
- Deprecation window expected for public SDK APIs

---

## Release Checklist

Before publishing `0.x`:

- [ ] Milestone acceptance criteria met ([MILESTONES.md](./MILESTONES.md))
- [ ] Tests green; critical paths covered
- [ ] Lint/format/build pass
- [ ] Public API docs updated
- [ ] Changelog updated
- [ ] Versions synchronized across packages
- [ ] No secrets in the release commit
- [ ] Example(s) still run against the released API surface
- [ ] npm pack contents reviewed (no junk files)
- [ ] Git tag created
- [ ] GitHub Release published

---

## Unresolved Tooling Choices (defer to later milestones)

- Exact CI publish permissions model
- Whether apps share a Docker image version scheme with npm versions

Resolved in Milestone 1: Changesets (fixed `@agentgauge/*`), tsup, Vitest colocated tests, Turborepo, `crypto.randomUUID()`, ISO-8601 timestamps.
