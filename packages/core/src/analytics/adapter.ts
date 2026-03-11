import type { AnalyticsEvent } from "../types/analytics-event.js";

/**
 * Layer 3 — Analytics Storage Adapter Interface
 *
 * All analytics storage backends implement this interface. The core package
 * ships with SQLite, Postgres, ClickHouse, and Webhook adapters.
 * Community adapters (MySQL, MongoDB, etc.) can implement this interface
 * without modifying the SDK.
 */
export interface AnalyticsAdapter {
  /**
   * Write a batch of analytics events to storage.
   * The adapter is responsible for batching, retries, and error handling.
   * Events in a batch may be from multiple concurrent requests.
   */
  writeBatch(events: AnalyticsEvent[]): Promise<void>;

  /**
   * Query analytics events. Used by the dashboard and CLI commands.
   * The query interface is intentionally simple — for complex queries,
   * users should query the storage directly.
   */
  query(options: AnalyticsQueryOptions): Promise<AnalyticsQueryResult>;

  /**
   * Close any open connections. Called on server shutdown.
   */
  close(): Promise<void>;
}

export interface AnalyticsQueryOptions {
  /** Filter by event type. If omitted, all types are returned. */
  type?: string;
  /** Filter events from this ISO 8601 timestamp forward. */
  from?: string;
  /** Filter events up to this ISO 8601 timestamp. */
  to?: string;
  /** Filter by agent name. */
  agentName?: string;
  /** Filter by trust tier. */
  tier?: string;
  /** Maximum number of events to return. Default: 100. */
  limit?: number;
  /** Number of events to skip (for pagination). Default: 0. */
  offset?: number;
}

export interface AnalyticsQueryResult {
  readonly events: AnalyticsEvent[];
  readonly total: number;
}

/**
 * A no-op adapter that silently discards all events.
 * Used when analytics is disabled (storage: "none").
 */
export class NullAnalyticsAdapter implements AnalyticsAdapter {
  async writeBatch(_events: AnalyticsEvent[]): Promise<void> {}
  async query(_options: AnalyticsQueryOptions): Promise<AnalyticsQueryResult> {
    return { events: [], total: 0 };
  }
  async close(): Promise<void> {}
}

/**
 * Webhook analytics adapter — POSTs analytics event batches to an HTTP endpoint.
 * Useful for sending events to external analytics platforms or custom handlers.
 */
export class WebhookAnalyticsAdapter implements AnalyticsAdapter {
  private readonly url: string;
  private readonly headers: Record<string, string>;

  constructor(url: string, headers: Record<string, string> = {}) {
    this.url = url;
    this.headers = headers;
  }

  async writeBatch(events: AnalyticsEvent[]): Promise<void> {
    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.headers,
        },
        body: JSON.stringify({ events }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        console.warn(
          `[@agentfriendly/analytics] Webhook ${this.url} returned ${response.status} — events may be lost`,
        );
      }
    } catch (error) {
      console.warn(
        `[@agentfriendly/analytics] Webhook ${this.url} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async query(_options: AnalyticsQueryOptions): Promise<AnalyticsQueryResult> {
    // Webhook adapter does not support querying — data is owned by the webhook target
    return { events: [], total: 0 };
  }

  async close(): Promise<void> {}
}
