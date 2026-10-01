import type { TraceEvent } from "@agentgauge/core";
import type { Transport } from "./transport.js";

export interface BatchedTransportOptions {
  /** Underlying transport that receives flushed batches (one send per event). */
  readonly transport: Transport;
  /** Maximum events before an automatic flush. Default: 20 */
  readonly maxBatchSize?: number;
  /** Milliseconds between automatic flushes. Default: 1000. Set 0 to disable timer. */
  readonly flushIntervalMs?: number;
}

/**
 * In-memory best-effort batching wrapper around another Transport.
 * Bounded queue: when full, older pending events are flushed before enqueue.
 * Does not persist to disk. Shutdown/flush deliver remaining events best-effort.
 */
export class BatchedTransport implements Transport {
  private readonly underlying: Transport;
  private readonly maxBatchSize: number;
  private readonly flushIntervalMs: number;
  private readonly queue: TraceEvent[] = [];
  private timer: ReturnType<typeof setInterval> | undefined;
  private flushing: Promise<void> | undefined;
  private shutDown = false;

  constructor(options: BatchedTransportOptions) {
    this.underlying = options.transport;
    this.maxBatchSize = options.maxBatchSize ?? 20;
    this.flushIntervalMs = options.flushIntervalMs ?? 1000;

    if (this.maxBatchSize < 1) {
      throw new Error("BatchedTransport maxBatchSize must be >= 1");
    }

    if (this.flushIntervalMs > 0) {
      this.timer = setInterval(() => {
        void this.flush();
      }, this.flushIntervalMs);
      // Allow process exit without waiting for the timer in Node.
      if (typeof this.timer === "object" && "unref" in this.timer) {
        this.timer.unref();
      }
    }
  }

  async send(event: TraceEvent): Promise<void> {
    if (this.shutDown) {
      await this.underlying.send(event);
      return;
    }

    this.queue.push(event);
    if (this.queue.length >= this.maxBatchSize) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.flushing) {
      await this.flushing;
      return;
    }

    this.flushing = this.flushQueue();
    try {
      await this.flushing;
    } finally {
      this.flushing = undefined;
    }
  }

  async shutdown(): Promise<void> {
    this.shutDown = true;
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    await this.flush();
    if (this.underlying.shutdown) {
      await this.underlying.shutdown();
    }
  }

  private async flushQueue(): Promise<void> {
    if (this.queue.length === 0) {
      if (this.underlying.flush) {
        await this.underlying.flush();
      }
      return;
    }

    const batch = this.queue.splice(0, this.queue.length);
    const errors: unknown[] = [];
    for (const event of batch) {
      try {
        await this.underlying.send(event);
      } catch (error) {
        errors.push(error);
      }
    }

    if (this.underlying.flush) {
      try {
        await this.underlying.flush();
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      throw errors[0];
    }
  }
}
