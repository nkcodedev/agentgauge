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
 *
 * Precedence for cloud ingestion credentials:
 * 1. Explicit `transport` (object or instance)
 * 2. Constructor `apiKey` / `endpoint`
 * 3. Environment variables `AGENTGAUGE_API_KEY` / `AGENTGAUGE_ENDPOINT`
 *
 * When `endpoint` is provided (constructor or env) without an explicit transport,
 * AgentGauge uses HttpTransport targeting `{endpoint}/v1/traces`.
 */
export interface AgentGaugeConfig {
  /**
   * AgentGauge API key. Required for HTTP transport when not passed on the transport itself.
   * Never logged or included in telemetry payloads.
   */
  readonly apiKey?: string;
  /**
   * Base URL of the AgentGauge API (e.g. `http://localhost:3000` or `https://api.agentgauge.dev`).
   * When set (and transport is omitted), configures HttpTransport to `POST {endpoint}/v1/traces`.
   */
  readonly endpoint?: string;
  /** Default project applied to traces when not overridden per trace. */
  readonly project?: string;
  /** Default environment applied to traces when not overridden per trace. */
  readonly environment?: string;
  /**
   * Transport used to deliver telemetry.
   * Defaults to console transport when omitted (unless endpoint/apiKey imply HTTP).
   */
  readonly transport?: TransportConfig;
  /**
   * Optional callback invoked when transport delivery fails.
   * Errors thrown from this callback are swallowed.
   */
  readonly onTransportError?: TransportErrorHandler;
}

function trimOrUndefined(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const t = value.trim();
  return t.length > 0 ? t : undefined;
}

function resolveIngestionUrl(base: string): string {
  const normalized = base.replace(/\/+$/, "");
  if (normalized.endsWith("/v1/traces") || normalized.endsWith("/v1/traces/batch")) {
    return normalized;
  }
  return `${normalized}/v1/traces`;
}

function resolveTransport(config: AgentGaugeConfig): Transport {
  const transport = config.transport;

  if (transport !== undefined) {
    if ("type" in transport) {
      if (transport.type === "console") {
        return new ConsoleTransport();
      }
      if (transport.type === "http") {
        const apiKey =
          trimOrUndefined(transport.apiKey) ??
          trimOrUndefined(config.apiKey) ??
          trimOrUndefined(process.env.AGENTGAUGE_API_KEY);
        if (apiKey === undefined) {
          throw new ConfigurationError(
            "apiKey is required when using HTTP transport (set AgentGaugeConfig.apiKey, transport.apiKey, or AGENTGAUGE_API_KEY)",
          );
        }
        return new HttpTransport({
          endpoint: transport.endpoint,
          apiKey,
        });
      }
      throw new ConfigurationError(
        `Unknown transport type: ${(transport as { type: string }).type}`,
      );
    }

    if (typeof transport.send !== "function") {
      throw new ConfigurationError("transport must implement send(event)");
    }

    return transport;
  }

  const apiKey = trimOrUndefined(config.apiKey) ?? trimOrUndefined(process.env.AGENTGAUGE_API_KEY);
  const endpoint =
    trimOrUndefined(config.endpoint) ?? trimOrUndefined(process.env.AGENTGAUGE_ENDPOINT);

  if (endpoint !== undefined || apiKey !== undefined) {
    if (apiKey === undefined) {
      throw new ConfigurationError(
        "apiKey is required when endpoint is set (set AgentGaugeConfig.apiKey or AGENTGAUGE_API_KEY)",
      );
    }
    if (endpoint === undefined) {
      throw new ConfigurationError(
        "endpoint is required when apiKey is set without an explicit transport (set AgentGaugeConfig.endpoint or AGENTGAUGE_ENDPOINT)",
      );
    }
    return new HttpTransport({
      endpoint: resolveIngestionUrl(endpoint),
      apiKey,
    });
  }

  return new ConsoleTransport();
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
    if (config.endpoint !== undefined && config.endpoint.trim().length === 0) {
      throw new ConfigurationError("endpoint must be a non-empty string when provided");
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
          sdk: { name: "@agentgauge/node", version: "0.5.0" },
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
