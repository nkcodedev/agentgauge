/**
 * Default example: mocked OpenAI client — no paid API calls.
 *
 *   pnpm --filter @agentgauge/openai-example start
 */
import { AgentGauge } from "@agentgauge/node";
import { observeOpenAI } from "@agentgauge/openai";

async function main(): Promise<void> {
  const gauge = new AgentGauge({
    project: "openai-example",
    environment: "development",
    transport: { type: "console" },
  });

  const mockClient = {
    responses: {
      async create(body: { model: string; input: string }) {
        return {
          id: "resp_mock",
          model: body.model,
          usage: {
            input_tokens: 42,
            output_tokens: 17,
            total_tokens: 59,
          },
          output_text: "Mocked answer (no network call).",
        };
      },
    },
    chat: {
      completions: {
        async create() {
          return {
            model: "gpt-4.1-mini",
            usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
            choices: [{ message: { role: "assistant", content: "mock" } }],
          };
        },
      },
    },
  };

  const openai = observeOpenAI(mockClient, {
    gauge,
    agentId: "demo-agent",
    tags: ["example"],
  });

  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: "Hello",
  });

  console.log("OpenAI mock result:", response.output_text);
  await gauge.shutdown();
}

await main();
