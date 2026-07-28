export interface TokenRateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

interface WindowState {
  startedAt: number;
  count: number;
}

function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} phải là số nguyên dương.`);
  }
}

export class TokenRateLimiter {
  readonly #maxRequests: number;
  readonly #windowMs: number;
  readonly #windows = new Map<string, WindowState>();

  constructor(options: TokenRateLimitOptions) {
    requirePositiveInteger(options.maxRequests, "maxRequests");
    requirePositiveInteger(options.windowMs, "windowMs");
    this.#maxRequests = options.maxRequests;
    this.#windowMs = options.windowMs;
  }

  consume(fingerprint: string, nowMs = Date.now()): RateLimitResult {
    if (fingerprint === "" || !Number.isFinite(nowMs)) {
      throw new Error("Đầu vào rate limit không hợp lệ.");
    }
    const existing = this.#windows.get(fingerprint);
    if (
      existing === undefined ||
      nowMs - existing.startedAt >= this.#windowMs
    ) {
      this.#windows.set(fingerprint, { startedAt: nowMs, count: 1 });
      return { allowed: true };
    }
    if (existing.count >= this.#maxRequests) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil(
            (existing.startedAt + this.#windowMs - nowMs) / 1_000,
          ),
        ),
      };
    }
    existing.count += 1;
    return { allowed: true };
  }
}

export class InFlightLimiter {
  readonly #maximum: number;
  #active = 0;

  constructor(maximum: number) {
    requirePositiveInteger(maximum, "maximum");
    this.#maximum = maximum;
  }

  get active(): number {
    return this.#active;
  }

  acquire(): (() => void) | null {
    if (this.#active >= this.#maximum) return null;
    this.#active += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.#active -= 1;
    };
  }
}
