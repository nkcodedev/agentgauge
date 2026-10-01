#!/usr/bin/env tsx
/**
 * Send one mocked wrapper trace per provider into the running local API.
 * No paid external AI calls.
 */
import { AgentGauge } from "@agentgauge/node";
import { observeOpenAI } from "@agentgauge/openai";
import { observeAnthropic } from "@agentgauge/anthropic";
import { observeGemini } from "@agentgauge/gemini";

const endpoint =
  process.env.AGENTGAUGE_ENDPOINT ?? process.env.AGENTGAUGE_API_URL ?? "http://127.0.0.1:3000";
const apiKey = process.env.AGENTGAUGE_API_KEY;
if (!apiKey) throw new Error("AGENTGAUGE_API_KEY required");

const provider = process.argv[2] ?? "all";

async function sendOpenAI(gauge: AgentGauge): Promise<void> {
  const client = observeOpenAI(
    {
      chat: {
        completions: {
          create: async (...args: unknown[]) => {
            void args;
            return {
              id: "chatcmpl-live",
              model: "gpt-4o-mini",
              choices: [{ message: { content: "secret" } }],
              usage: { prompt_tokens: 1200, completion_tokens: 300, total_tokens: 1500 },
            };
          },
        },
      },
    },
    { gauge, agentId: "support-agent" },
  );
  await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "live openai" }],
  });
}

async function sendAnthropic(gauge: AgentGauge): Promise<void> {
  const client = observeAnthropic(
    {
      messages: {
        create: async (...args: unknown[]) => {
          void args;
          return {
            id: "msg_live",
            model: "claude-sonnet-5-5",
            content: [{ type: "text", text: "secret" }],
            usage: { input_tokens: 1500, output_tokens: 400 },
          };
        },
      },
    },
    { gauge, agentId: "coding-agent" },
  );
  await client.messages.create({
    model: "claude-sonnet-5-5",
    max_tokens: 64,
    messages: [{ role: "user", content: "live anthropic" }],
  });
}

async function sendGemini(gauge: AgentGauge): Promise<void> {
  const client = observeGemini(
    {
      models: {
        generateContent: async (...args: unknown[]) => {
          void args;
          return {
            model: "gemini-2.5-flash",
            text: "secret",
            usageMetadata: {
              promptTokenCount: 1100,
              candidatesTokenCount: 250,
              totalTokenCount: 1350,
            },
          };
        },
      },
    },
    { gauge, agentId: "research-agent" },
  );
  await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: "live gemini",
  });
}

async function main(): Promise<void> {
  const key = apiKey as string;
  const gauge = new AgentGauge({
    apiKey: key,
    endpoint,
    project: "demo-project",
    environment: "development",
  });

  if (provider === "all" || provider === "openai") await sendOpenAI(gauge);
  if (provider === "all" || provider === "anthropic") await sendAnthropic(gauge);
  if (provider === "all" || provider === "google" || provider === "gemini") await sendGemini(gauge);

  await gauge.shutdown();
  console.log(JSON.stringify({ ok: true, provider, endpoint }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
