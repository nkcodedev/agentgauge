/**
 * Simple in-process token-bucket / fixed-window rate limiter.
 *
 * NOT horizontally authoritative: each API process has its own counters.
 * Suitable for local/single-instance MVP only.
 */

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly resetAt: number;
}

export class InMemoryRateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  check(key: string, now = Date.now()): RateLimitResult {
    const current = this.windows.get(key);
    if (!current || now >= current.resetAt) {
      const resetAt = now + this.windowMs;
      this.windows.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: this.limit - 1, resetAt };
    }

    if (current.count >= this.limit) {
      return { allowed: false, remaining: 0, resetAt: current.resetAt };
    }

    current.count += 1;
    return {
      allowed: true,
      remaining: this.limit - current.count,
      resetAt: current.resetAt,
    };
  }

  /** Test helper */
  reset(): void {
    this.windows.clear();
  }
}
