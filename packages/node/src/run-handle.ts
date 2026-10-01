import { ConfigurationError, validateEndRunInput, type EndRunInput } from "@agentgauge/core";
import type { EndRunPayload } from "./transport.js";

/**
 * Handle returned by AgentGauge.startRun().
 */
export interface RunHandle {
  readonly id: string;
  readonly name: string;
  readonly agentId: string;
  end(input: EndRunInput): Promise<void>;
}

export interface RunEmitter {
  assertNotShutdown(): void;
  endRun(runId: string, payload: EndRunPayload): Promise<void>;
}

export class ManualRunHandle implements RunHandle {
  readonly id: string;
  readonly name: string;
  readonly agentId: string;

  private finished = false;
  private readonly emitter: RunEmitter;

  constructor(
    ctx: { readonly id: string; readonly name: string; readonly agentId: string },
    emitter: RunEmitter,
  ) {
    this.id = ctx.id;
    this.name = ctx.name;
    this.agentId = ctx.agentId;
    this.emitter = emitter;
  }

  async end(input: EndRunInput): Promise<void> {
    this.emitter.assertNotShutdown();
    if (this.finished) {
      throw new ConfigurationError("Run has already been completed");
    }
    const validated = validateEndRunInput(input);
    this.finished = true;
    await this.emitter.endRun(this.id, validated);
  }
}
