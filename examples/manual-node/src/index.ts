import { AgentGauge } from "@agentgauge/node";

/**
 * Manual tracing example for Milestone 1.
 *
 * Run from repo root:
 *   pnpm --filter @agentgauge/manual-node-example start
 *
 * Or from this directory after install:
 *   pnpm start
 *
 * Uses console transport — intended for local development only.
 * Console output may include user-supplied metadata/tags.
 */

async function simulateAiCall(
  prompt: string,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  await new Promise((resolve) => setTimeout(resolve, 25));
  return {
    text: `Simulated answer for: ${prompt}`,
    inputTokens: 1200,
    outputTokens: 320,
  };
}

async function main(): Promise<void> {
  const gauge = new AgentGauge({
    apiKey: "ag_test_example",
    project: "manual-example",
    environment: "development",
    transport: { type: "console" },
  });

  // Success path
  const successTrace = gauge.startTrace({
    agentId: "support-agent",
    provider: "openai",
    model: "gpt-5",
    operationName: "answer-customer",
    tags: ["example", "success"],
    metadata: { channel: "docs" },
  });

  try {
    const result = await simulateAiCall("How do I reset my password?");
    successTrace.end({
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });
    console.log("Business result:", result.text);
  } catch (error) {
    successTrace.fail(error);
    throw error;
  }

  // Failure path
  const failureTrace = gauge.startTrace({
    agentId: "support-agent",
    provider: "openai",
    model: "gpt-5",
    operationName: "answer-customer",
    tags: ["example", "failure"],
  });

  try {
    throw new Error("Simulated provider timeout");
  } catch (error) {
    failureTrace.fail(error);
    console.log("Recorded failed trace for simulated error");
  }

  await gauge.flush();
  await gauge.shutdown();
}

await main();
