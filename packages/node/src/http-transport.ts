import { ConfigurationError, type TraceEvent } from "@agentgauge/core";
import type { CreateRunPayload, EndRunPayload, Transport } from "./transport.js";

export interface HttpTransportOptions {
  readonly endpoint: string;
  readonly apiKey?: string;
  readonly fetchImpl?: typeof fetch;
}

function deriveApiBase(endpoint: string): string {
  const normalized = endpoint.trim().replace(/\/+$/, "");
  if (normalized.endsWith("/v1/traces/batch")) {
    return normalized.slice(0, -"/v1/traces/batch".length);
  }
  if (normalized.endsWith("/v1/traces")) {
    return normalized.slice(0, -"/v1/traces".length);
  }
  return normalized;
}

/**
 * Minimal HTTP transport using native fetch.
 * Posts a single-event batch envelope compatible with the planned ingestion API.
 *
 * Delivery failures reject the returned promise; AgentGauge catches them so customer
 * business logic is unaffected.
 */
export class HttpTransport implements Transport {
  private readonly endpoint: string;
  private readonly apiBase: string;
  private readonly apiKey: string | undefined;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpTransportOptions) {
    if (typeof options.endpoint !== "string" || options.endpoint.trim().length === 0) {
      throw new ConfigurationError("HttpTransport endpoint must be a non-empty string");
    }
    this.endpoint = options.endpoint.trim();
    this.apiBase = deriveApiBase(this.endpoint);
    this.apiKey =
      typeof options.apiKey === "string" && options.apiKey.trim().length > 0
        ? options.apiKey.trim()
        : undefined;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json",
    };
    if (this.apiKey !== undefined) {
      headers.authorization = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  async send(event: TraceEvent): Promise<void> {
    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: this.authHeaders(),
      body: JSON.stringify({ events: [event] }),
    });

    if (!response.ok) {
      throw new Error(`AgentGauge HTTP transport failed with status ${response.status}`);
    }
  }

  async createRun(payload: CreateRunPayload): Promise<void> {
    const response = await this.fetchImpl(`${this.apiBase}/v1/runs`, {
      method: "POST",
      headers: this.authHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`AgentGauge HTTP createRun failed with status ${response.status}`);
    }
  }

  async endRun(runId: string, payload: EndRunPayload): Promise<void> {
    const response = await this.fetchImpl(
      `${this.apiBase}/v1/runs/${encodeURIComponent(runId)}/end`,
      {
        method: "POST",
        headers: this.authHeaders(),
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      throw new Error(`AgentGauge HTTP endRun failed with status ${response.status}`);
    }
  }

  async flush(): Promise<void> {
    // Milestone 1 sends immediately; nothing buffered.
  }

  async shutdown(): Promise<void> {
    // no-op
  }
}
