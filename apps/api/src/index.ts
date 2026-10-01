import { buildApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

async function main(): Promise<void> {
  const app = await buildApp();
  await app.listen({ port, host });
  app.log.info(`AgentGauge API listening on http://${host}:${port}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
