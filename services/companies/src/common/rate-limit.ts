/**
 * A fixed-window rate limiter for the handful of public routes this service
 * exposes.
 *
 * It is in-process, and that is a deliberate compromise rather than an
 * oversight. `packages/nestshared` has no Redis helper — the Go side has
 * `goshared/redisx`, the TypeScript side does not — and inventing one here
 * would put a second, divergent Redis client in the tree for one endpoint. The
 * consequence is honest and bounded: with N replicas a determined client gets
 * N times the budget. That still turns a slug-enumeration sweep from minutes
 * into days, which is what the limit is for; it is not a defence against a
 * distributed attacker, and a shared counter would not be either.
 *
 * Replace this with a Redis-backed counter the moment nestshared grows one.
 */

const WINDOW_MS = 60_000;

/**
 * How many distinct clients to track before evicting.
 *
 * A map keyed by client address is a memory leak with a nice name unless it is
 * bounded: an attacker spraying spoofed forwarded addresses would otherwise
 * grow it without limit. When the ceiling is reached the whole window is
 * dropped, which costs one window of accounting and cannot be exploited for
 * more than that.
 */
const MAX_TRACKED_CLIENTS = 50_000;

export class FixedWindowLimiter {
  private counts = new Map<string, number>();
  private windowStart: number;

  /**
   * @param limit requests allowed per client per window
   * @param now injectable so the window boundary can be tested without waiting
   *   a real minute
   */
  constructor(
    private readonly limit: number,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.windowStart = this.now();
  }

  /**
   * Records a request and reports whether it is within budget.
   *
   * A fixed window rather than a sliding one: the worst case is a client
   * getting 2x the limit across a boundary, and for an enumeration guard that
   * is irrelevant next to the cost of keeping per-request timestamps for every
   * caller.
   */
  allow(key: string): boolean {
    const now = this.now();

    if (now - this.windowStart >= WINDOW_MS) {
      this.counts = new Map();
      this.windowStart = now;
    }

    const used = this.counts.get(key) ?? 0;
    if (used >= this.limit) {
      return false;
    }

    if (used === 0 && this.counts.size >= MAX_TRACKED_CLIENTS) {
      this.counts = new Map();
      this.windowStart = now;
    }

    this.counts.set(key, used + 1);
    return true;
  }
}

/**
 * Identifies the caller of a public request.
 *
 * `X-Forwarded-For` is set by the gateway's reverse proxy, which overwrites
 * whatever the client sent — so the first entry is the address the gateway
 * actually saw, not a value the client chose. Only the address is used, never
 * a body or query field, because those are exactly what a sweep would vary.
 */
export function clientKey(headers: Record<string, string | string[] | undefined>, fallback: string): string {
  const header = headers['x-forwarded-for'];
  const raw = (Array.isArray(header) ? header[0] : header) ?? '';
  const first = raw.split(',')[0]?.trim() ?? '';
  return first !== '' ? first : fallback;
}
