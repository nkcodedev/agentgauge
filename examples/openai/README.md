# OpenAI example

## Mocked (default — no paid API)

```bash
pnpm install
pnpm build
pnpm --filter @agentgauge/openai-example start
```

## Live (optional)

Requires your own OpenAI API key — never commit it.

```bash
OPENAI_API_KEY=sk-... pnpm --filter @agentgauge/openai-example start:live
```
