import type { AgentContext } from "../types/agent-context.js";
import type { AccessConfig } from "../types/config.js";

/**
 * Layer 4 — In-Memory Rate Limiter for Agent Requests
 *
 * A simple sliding window rate limiter for agent traffic. Uses in-memory storage
 * (a Map of request timestamps per key). This is suitable for single-instance
 * deployments. For distributed deployments, the Hono adapter uses Cloudflare KV
 * and the Edge/distributed case can use an external Redis-compatible store.
 *
 * The rate limiter is agent-specific — human traffic is never rate-limited
 * by this mechanism.
 *
 * Rate limit key strategies:
 * - "identity": verified agent ID (or IP fallback for unverified agents)
 * - "ip": always use IP address
 * - "ua": use user-agent string as the key
 */

interface WindowEntry {
  timestamps: number[];
}

export class InMemoryRateLimiter {
  private readonly windows = new Map<string, WindowEntry>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number, windowSeconds: number = 60) {
    this.maxRequests = maxRequests;
    this.windowMs = windowSeconds * 1000;
  }

  /**
   * Check whether the request should be allowed.
   * Returns true if the request is within the rate limit.
   * Returns false if the rate limit has been exceeded.
   */
  check(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const entry = this.windows.get(key);
    if (!entry) {
      this.windows.set(key, { timestamps: [now] });
      return true;
    }

    // Prune timestamps outside the current window
    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

    if (entry.timestamps.length >= this.maxRequests) {
      return false;
    }

    entry.timestamps.push(now);
    return true;
  }

  /**
   * Get the number of requests made by a key in the current window.
   */
  getCount(key: string): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const entry = this.windows.get(key);
    if (!entry) return 0;
    return entry.timestamps.filter((ts) => ts > windowStart).length;
  }

  /**
   * Clear all rate limit data. Only needed in tests.
   */
  clear(): void {
    this.windows.clear();
  }
}

/**
 * Derive the rate limit key from an agent request context and config.
 */
export function getRateLimitKey(
  context: AgentContext,
  keyBy: AccessConfig["rateLimit"] extends undefined ? never : NonNullable<AccessConfig["rateLimit"]>["keyBy"],
): string {
  switch (keyBy) {
    case "ip":
      return context.headers["x-forwarded-for"]?.split(",")[0]?.trim() ?? context.headers["x-real-ip"] ?? "unknown-ip";
    case "ua":
      return context.userAgent || "no-ua";
    case "identity":
    default:
      // Prefer verified identity, fall back to UA, then IP
      return (
        context.verifiedIdentity?.agentId ??
        context.matchedAgent?.agentName ??
        context.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
        "unknown"
      );
  }
}
