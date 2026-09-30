import {
  ConfigurationError,
  validateStartTraceInput,
  type StartTraceInput,
  type TraceEvent,
} from "@agentgauge/core";
import { ConsoleTransport } from "./console-transport.js";
import { HttpTransport } from "./http-transport.js";
import {
  ManualTraceHandle,
  createTraceContext,
  type TraceEmitter,
  type TraceHandle,
} from "./trace-handle.js";
import type { Transport, TransportErrorHandler } from "./transport.js";

/**
 * Shorthand transport configuration for built-in transports.
 */
export type TransportConfig =
  | Transport
  | { readonly type: "console" }
  | { readonly type: "http"; readonly endpoint: string; readonly apiKey?: string };

/**
 * Configuration for the AgentGauge Node.js client.
 */
export interface AgentGaugeConfig {
  /**
   * AgentGauge API key. Required for HTTP transport when not passed on the transport itself.
   * Never logged or included in telemetry payloads.
   */
  readonly apiKey?: string;
  /** Default project applied to traces when not overridden per trace. */
  readonly project?: string;
  /** Default environment applied to traces when not overridden per trace. */
  readonly environment?: string;
  /**
   * Transport used to deliver telemetry.
   * Defaults to console transport when omitted.
   */
  readonly transport?: TransportConfig;
  /**
   * Optional callback invoked when transport delivery fails.
   * Errors thrown from this callback are swallowed.
   */
  readonly onTransportError?: TransportErrorHandler;
}

function resolveTransport(config: AgentGaugeConfig): Transport {
  const transport = config.transport;

  if (transport === undefined) {
    return new ConsoleTransport();
  }

  if ("type" in transport) {
    if (transport.type === "console") {
      return new ConsoleTransport();
    }
    if (transport.type === "http") {
      const apiKey = transport.apiKey ?? config.apiKey;
      if (apiKey === undefined || apiKey.trim().length === 0) {
        throw new ConfigurationError(
          "apiKey is required when using HTTP transport (set AgentGaugeConfig.apiKey or transport.apiKey)",
        );
      }
      return new HttpTransport({
        endpoint: transport.endpoint,
        apiKey,
      });
    }
    throw new ConfigurationError(`Unknown transport type: ${(transport as { type: string }).type}`);
  }

  if (typeof transport.send !== "function") {
    throw new ConfigurationError("transport must implement send(event)");
  }

  return transport;
}

/**
 * AgentGauge Node.js client for manual AI agent tracing.
 *
 * Telemetry delivery is best-effort: transport failures never throw into the
 * customer application path. SDK misuse (invalid inputs, double completion,
 * use after shutdown) throws typed AgentGauge errors.
 */
export class AgentGauge implements TraceEmitter {
  private readonly transport: Transport;
  private readonly project: string | undefined;
  private readonly environment: string | undefined;
  private readonly onTransportError: TransportErrorHandler | undefined;
  private shutdownRequested = false;
  private readonly pending = new Set<Promise<void>>();

  constructor(config: AgentGaugeConfig = {}) {
    if (config.project !== undefined && config.project.trim().length === 0) {
      throw new ConfigurationError("project must be a non-empty string when provided");
    }
    if (config.environment !== undefined && config.environment.trim().length === 0) {
      throw new ConfigurationError("environment must be a non-empty string when provided");
    }

    this.project = config.project?.trim();
    this.environment = config.environment?.trim();
    this.onTransportError = config.onTransportError;
    this.transport = resolveTransport(config);
  }

  /**
   * Starts a manual trace. Generates eventId/traceId and start timestamp automatically.
   * @throws ValidationError for invalid inputs
   * @throws ConfigurationError if the client has been shut down
   */
  startTrace(input: StartTraceInput): TraceHandle {
    this.assertNotShutdown();
    const validated = validateStartTraceInput(input);

    const project = validated.project ?? this.project;
    const environment = validated.environment ?? this.environment;

    const ctx = createTraceContext({
      ...validated,
      ...(project !== undefined ? { project } : {}),
      ...(environment !== undefined ? { environment } : {}),
    });

    return new ManualTraceHandle(ctx, this);
  }

  /**
   * @internal Used by TraceHandle. Delivers an event best-effort.
   */
  emit(event: TraceEvent): void {
    const task = this.transport.send(event).catch((error: unknown) => {
      this.notifyTransportError(error, event);
    });
    this.pending.add(task);
    void task.finally(() => {
      this.pending.delete(task);
    });
  }

  assertNotShutdown(): void {
    if (this.shutdownRequested) {
      throw new ConfigurationError("AgentGauge has been shut down");
    }
  }

  /**
   * Waits for in-flight transport sends and transport.flush() if present.
   */
  async flush(): Promise<void> {
    await Promise.allSettled([...this.pending]);
    if (this.transport.flush) {
      try {
        await this.transport.flush();
      } catch (error) {
        this.notifyTransportError(error, {
          eventId: "flush",
          traceId: "flush",
          agentId: "agentgauge",
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          latencyMs: 0,
          status: "error",
          sdk: { name: "@agentgauge/node", version: "0.1.0" },
        });
      }
    }
  }

  /**
   * Flushes pending telemetry and shuts down the transport.
   * After shutdown, startTrace/end/fail throw ConfigurationError (SDK misuse).
   */
  async shutdown(): Promise<void> {
    await this.flush();
    this.shutdownRequested = true;
    if (this.transport.shutdown) {
      try {
        await this.transport.shutdown();
      } catch {
        // Delivery/shutdown transport failures must not throw to callers by policy.
        // shutdown() itself is an explicit SDK lifecycle call; we still swallow
        // transport shutdown errors to keep lifecycle calls safe.
      }
    }
  }

  private notifyTransportError(error: unknown, event: TraceEvent): void {
    if (!this.onTransportError) {
      return;
    }
    try {
      this.onTransportError(error, event);
    } catch {
      // Never let user callbacks break the application.
    }
  }
}
