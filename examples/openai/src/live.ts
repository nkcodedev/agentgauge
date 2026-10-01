/**
 * Optional LIVE example — runs only when OPENAI_API_KEY is set.
 *
 *   OPENAI_API_KEY=... pnpm --filter @agentgauge/openai-example start:live
 *
 * Never commit API keys.
 */
import OpenAI from "openai";
import { AgentGauge } from "@agentgauge/node";
import { observeOpenAI } from "@agentgauge/openai";

async function main(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    console.error("Set OPENAI_API_KEY to run the live example.");
    process.exit(1);
  }

  const gauge = new AgentGauge({
    project: "openai-example",
    environment: "development",
    transport: { type: "console" },
  });

  const openai = observeOpenAI(new OpenAI(), {
    gauge,
    agentId: "demo-agent",
  });

  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: "Say hello in one short sentence.",
  });

  console.log(response);
  await gauge.shutdown();
}

await main();
