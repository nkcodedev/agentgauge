# Self-hosting AgentGauge

**PostgreSQL 16+** is required for the AgentGauge API, worker, and dashboard.

PostgreSQL is **not** required to use the SDK with console or custom transports alone.

## Architecture

```text
SDK → AgentGauge API → PostgreSQL → Dashboard
```

## Prerequisites

- Node.js >= 20
- pnpm
- Docker (for local PostgreSQL via `docker-compose.yml`)

## Setup

```bash
pnpm install
docker compose up -d
pnpm db:migrate
pnpm dev:seed          # prints a one-time API key
```

Configure `apps/dashboard/.env.local`:

```bash
AGENTGAUGE_API_URL=http://127.0.0.1:3000
AGENTGAUGE_API_KEY=ag_live_...
```

Start the stack:

```bash
pnpm dev
```

| Service   | URL                                |
| --------- | ---------------------------------- |
| API       | http://localhost:3000              |
| Dashboard | http://localhost:3001              |
| Health    | http://localhost:3000/health       |
| OpenAPI   | http://localhost:3000/openapi.json |

Optional demo telemetry: `pnpm dev:seed-demo`.

## Auth model (MVP)

Dashboard auth for the MVP is a **server-side project API key** (`AGENTGAUGE_API_KEY`) — not end-user login/OAuth.

The browser never receives the project key. Dashboard routes proxy JSON and SSE through Next.js BFF handlers that attach the server-only key.

## Model pricing

AgentGauge ships default prices for OpenAI, Anthropic, and Google models. Self-hosted administrators can review and extend that catalog at `/settings/model-pricing`.

- Prices are matched by exact provider + model and an effective date range.
- Adding a rate for a seeded model stores an **override**. A provider or model AgentGauge does not ship is **custom**.
- Updating a rate closes the previous row and appends a new one. Already priced traces keep their stored cost.
- New traces, and eligible unpriced traces picked up by the background worker, use the new rate.
- Estimated cost is not an invoice. Cache, batch, long-context, and enterprise rates are not fully modeled.
- The catalog is installation-wide. The dashboard project API key can change it. There is no separate billing admin role.

## Related

- [API.md](./API.md) — HTTP endpoints
- [ARCHITECTURE.md](./ARCHITECTURE.md) — package layout and data flow
- [SECURITY.md](../SECURITY.md) — keys, privacy, limitations
