# AgentGauge Security

**Status:** Initial security principles (pre-implementation)
**Related:** [TELEMETRY_SPEC.md](./TELEMETRY_SPEC.md), [API_DESIGN.md](./API_DESIGN.md), [PRODUCT_SCOPE.md](./PRODUCT_SCOPE.md)

AgentGauge collects **operational telemetry**, not secrets and not conversational content by default. Security and privacy defaults are part of the product contract.

---

## Core Principles

1. **Telemetry, not secrets** — The SDK captures agent operational metadata. It must not harvest provider API keys or application secrets.
2. **Privacy-first defaults** — Raw prompts and completions are **not** captured by default (see [ADR-006](./DECISIONS.md#adr-006-raw-promptcompletion-capture-is-disabled-by-default)).
3. **Least privilege** — API keys, database roles, and cloud permissions grant only what is required.
4. **Defense in depth** — Validation, authn/authz, TLS, rate limits, and size limits work together.
5. **Safe failure** — Security controls fail closed on the server; the SDK fails open for telemetry so customer apps are not disrupted ([ADR-005](./DECISIONS.md#adr-005-telemetry-collection-must-never-break-the-customers-application)).

---

## Secrets Handling

### AgentGauge API keys

- Must **never** be logged (SDK, API, worker, dashboard server logs, or error reports).
- Must not appear in trace metadata, tags, or event payloads.
- Store only hashed representations server-side where appropriate (e.g. keyed hash / password-hashing style for API keys — exact algorithm chosen at implementation time).
- Display full secrets only once at creation time in the dashboard; thereafter show prefixes only.
- Transmit only over TLS for hosted ingestion.

### Provider API keys (OpenAI, etc.)

- AgentGauge must **never collect** customer provider API keys unless a future architecture explicitly requires it and is approved via ADR.
- Instrumentation reads responses from the already-configured provider SDK in the customer process; it does not ask users to paste provider keys into AgentGauge.
- Docs and examples must not encourage putting provider keys into AgentGauge configuration.

### Application secrets

- Warn in docs: do not place passwords, tokens, or PII in `metadata` or `tags`.
- Server-side validation may optionally reject known sensitive key names later; V1 relies primarily on documentation and defaults.

---

## Prompt & Completion Privacy

| Content | Default V1 behavior |
|---------|---------------------|
| Prompts / inputs | **Not captured** |
| Completions / outputs | **Not captured** |
| Token counts | Captured |
| Model / provider | Captured |
| Latency / status / errors | Captured (errors sanitized) |
| Custom metadata / tags | Captured as supplied by the user |

If optional content capture is ever added:

- It must be **opt-in**, explicit, documented, and versioned
- It must carry clear UI/docs warnings about privacy and compliance
- It is **out of MVP scope**

---

## Metadata Privacy Implications

`metadata` and `tags` are user-controlled extension fields.

- Treat them as potentially sensitive
- Document that customers are responsible for not embedding PII or secrets
- Apply payload size limits to reduce accidental large dumps
- Do not index or display metadata in ways that encourage pasting transcripts

---

## Authentication & Authorization

### Ingestion / API

- Requests authenticated with AgentGauge API keys (see [API_DESIGN.md](./API_DESIGN.md))
- Keys are scoped to an organization / project boundary (exact model finalized in Milestone 3)
- Authorization must prevent cross-organization and cross-project data access

### Dashboard

- Authenticated access to project data
- API-key management requires appropriate privileges
- Session/auth mechanism chosen during dashboard implementation; must enforce the same org/project boundaries

---

## Transport Security

- **TLS required** for hosted AgentGauge ingestion endpoints
- Reject cleartext credentials in production configurations
- HSTS and modern TLS defaults at the edge when infrastructure exists

---

## API Hardening

| Control | Intent |
|---------|--------|
| Payload validation | Reject malformed events early |
| Payload-size limits | Cap request body and per-event size |
| Rate limiting | Reduce abuse and noisy-neighbor risk |
| Idempotency (where supported) | Safe retries without duplicate storms where designed |
| Standard errors | Avoid leaking stack traces or internal paths to clients |

---

## SDK Security Posture

- Best-effort telemetry; transport errors do not fail customer AI calls
- No default global hooks that exfiltrate unrelated process data
- Debug logging redacts secrets
- Dependencies kept minimal to reduce supply-chain risk

---

## Dependency & Supply Chain Security

- Prefer well-maintained, minimal dependencies
- Lockfile committed once packages exist
- Run dependency vulnerability scanning in CI when CI exists
- Review new dependencies in PRs for necessity and maintenance health
- Enable secret scanning for the repository (GitHub secret scanning / equivalent)

---

## Data Retention & Access (Initial Guidance)

Exact retention windows are an unresolved product decision for Milestone 3+. Until then:

- Design persistence so retention policies can be applied later
- Limit production access to telemetry stores
- Do not use production telemetry data for model training

---

## Security Non-Goals (MVP)

- Full enterprise SIEM integration
- Customer-managed encryption keys (CMEK)
- Formal certification (SOC2, etc.) as a launch blocker for early OSS milestones
- Advanced agent security product features (prompt injection shields, policy engines)

These may appear on a future roadmap but are not MVP requirements.

---

## Incident Response (Lightweight)

When a suspected secret leak occurs:

1. Rotate affected AgentGauge API keys immediately
2. Invalidate hashed key material server-side
3. Scrub logs if secrets were written
4. Document the incident and preventive fix

---

## Checklist for Contributors

- [ ] No secrets in logs, fixtures, or docs examples (use placeholders)
- [ ] No prompt/completion capture without explicit opt-in design + ADR
- [ ] Authz boundaries respected in API/worker/dashboard changes
- [ ] New env vars documented with sensitivity notes
- [ ] Dependencies justified

---

## Related Documents

- [DECISIONS.md](./DECISIONS.md)
- [TELEMETRY_SPEC.md](./TELEMETRY_SPEC.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)
