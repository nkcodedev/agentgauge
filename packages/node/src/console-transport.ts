import type { TraceEvent } from "@agentgauge/core";
import type { CreateRunPayload, EndRunPayload, Transport } from "./transport.js";

/**
 * Development transport that prints normalized telemetry to the console.
 *
 * WARNING: This transport is intended for local development. It may print
 * user-supplied metadata and tags. Never use it if metadata may contain secrets.
 * AgentGauge API keys are never printed.
 */
export class ConsoleTransport implements Transport {
  async send(event: TraceEvent): Promise<void> {
    // Intentionally print the event for local debugging.
    console.log("[agentgauge]", JSON.stringify(event));
  }

  async createRun(payload: CreateRunPayload): Promise<void> {
    console.log("[agentgauge] createRun", JSON.stringify(payload));
  }

  async endRun(runId: string, payload: EndRunPayload): Promise<void> {
    console.log("[agentgauge] endRun", JSON.stringify({ runId, ...payload }));
  }

  async flush(): Promise<void> {
    // no-op
  }

  async shutdown(): Promise<void> {
    // no-op
  }
}
