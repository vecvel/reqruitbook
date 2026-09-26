import { NextRequest } from "next/server";

interface RateLimitRecord {
  timestamps: number[];
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number; // Unix timestamp in seconds
  retryAfter: number; // Seconds until next permitted request
}

// In-memory sliding window store
const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup stale entries every 5 minutes to prevent memory growth
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      // Remove timestamps older than 10 minutes
      record.timestamps = record.timestamps.filter((ts) => now - ts < 600000);
      if (record.timestamps.length === 0) {
        rateLimitStore.delete(key);
      }
    }
  }, 300000);
}

/**
 * Extracts client IP address accurately from standard proxy and CDN headers.
 */
export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }
  return "127.0.0.1";
}

/**
 * Checks a sliding-window rate limit for a specific identifier key.
 *
 * @param key Unique identifier (e.g., `login:192.168.1.1` or `upload:user_123`)
 * @param limit Maximum allowed requests within the time window
 * @param windowMs Time window duration in milliseconds (default: 60,000 ms = 1 minute)
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number = 60000,
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;

  let record = rateLimitStore.get(key);
  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(key, record);
  }

  // Filter timestamps to only those within the active sliding window
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

  const requestCount = record.timestamps.length;
  const resetTime = Math.ceil((now + windowMs) / 1000);

  if (requestCount >= limit) {
    const oldestInWindow = record.timestamps[0] || now;
    const retryAfter = Math.max(1, Math.ceil((oldestInWindow + windowMs - now) / 1000));

    return {
      allowed: false,
      limit,
      remaining: 0,
      resetTime,
      retryAfter,
    };
  }

  // Record this request
  record.timestamps.push(now);

  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - record.timestamps.length),
    resetTime,
    retryAfter: 0,
  };
}

/**
 * Returns standard rate limiting HTTP headers for enterprise compliance.
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetTime),
  };

  if (!result.allowed) {
    headers["Retry-After"] = String(result.retryAfter);
  }

  return headers;
}

// Enterprise predefined limiters
export const RATE_LIMIT_CONFIGS = {
  // Auth endpoints: 5 attempts per minute per IP
  AUTH: { limit: 5, windowMs: 60000 },
  // File uploads: 10 uploads per minute per IP
  UPLOAD: { limit: 10, windowMs: 60000 },
  // Public application form: 15 submissions per minute per IP
  PUBLIC_FORM: { limit: 15, windowMs: 60000 },
  // General API endpoints: 100 requests per minute per IP
  API: { limit: 100, windowMs: 60000 },
};
