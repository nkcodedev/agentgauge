import { ConfigurationError, type TraceEvent } from "@agentgauge/core";
import type { Transport } from "./transport.js";

export interface HttpTransportOptions {
  readonly endpoint: string;
  readonly apiKey?: string;
  readonly fetchImpl?: typeof fetch;
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
  private readonly apiKey: string | undefined;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpTransportOptions) {
    if (typeof options.endpoint !== "string" || options.endpoint.trim().length === 0) {
      throw new ConfigurationError("HttpTransport endpoint must be a non-empty string");
    }
    this.endpoint = options.endpoint.trim();
    this.apiKey =
      typeof options.apiKey === "string" && options.apiKey.trim().length > 0
        ? options.apiKey.trim()
        : undefined;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async send(event: TraceEvent): Promise<void> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json",
    };
    if (this.apiKey !== undefined) {
      headers.authorization = `Bearer ${this.apiKey}`;
    }

    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ events: [event] }),
    });

    if (!response.ok) {
      throw new Error(`AgentGauge HTTP transport failed with status ${response.status}`);
    }
  }

  async flush(): Promise<void> {
    // Milestone 1 sends immediately; nothing buffered.
  }

  async shutdown(): Promise<void> {
    // no-op
  }
}
