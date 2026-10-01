# AgentGauge Security

**Status:** Milestone 4 (`0.4.0`) — dashboard MVP + API-key management
**Related:** [TELEMETRY_SPEC.md](./TELEMETRY_SPEC.md), [API_DESIGN.md](./API_DESIGN.md), [DECISIONS.md](./DECISIONS.md)

AgentGauge collects **operational telemetry**, not secrets and not conversational content by default.

---

## Core Principles

1. **Telemetry, not secrets**
2. **Privacy-first defaults** — prompts/completions not captured
3. **Least privilege** — project-scoped API keys
4. **Defense in depth** — validation, auth, rate/size limits
5. **Safe failure** — SDK best-effort; API fails closed

---

## API keys (0.3.0)

- Format: `ag_live_<secret>` or `ag_test_<secret>`
- Generated with 32 bytes of CSPRNG entropy (base64url)
- Stored as `key_prefix` + **SHA-256** hash of `pepper:plaintext` (see ADR-015)
- Plaintext shown **once** at seed / `pnpm dev:create-api-key`
- Never logged; never placed in TraceEvent payloads
- Revocation via `revoked_at`

## Tenant isolation

- API key binds to one organization + project
- All reads/writes are project-scoped
- Payload `project` cannot redirect writes to another project (`project_mismatch`)

## Ingestion controls

| Control | MVP behavior |
|---------|--------------|
| Auth | Bearer API key required on `/v1/*` |
| Body size | 256 KiB |
| Batch size | ≤ 100 events |
| Metadata | key count, depth, string length, serialized size limits |
| Tags | count + length limits |
| Rate limit | In-process per API-key window (**not** multi-instance authoritative) |
| Errors | No stack traces in responses |

## Privacy

| Content | Behavior |
|---------|----------|
| Prompts / completions | Not collected |
| Provider API keys | Not collected |
| Tokens / model / latency / status | Collected |
| Metadata / tags | User-supplied; size-limited |

## Known limitations

- In-process rate limiting does not coordinate across multiple API replicas
- TLS termination is an operator concern for hosted deployments
- Dashboard session auth is out of scope until Milestone 4

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
