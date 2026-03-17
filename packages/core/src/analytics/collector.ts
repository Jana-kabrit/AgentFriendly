import { randomUUID } from "node:crypto";

import type { AnalyticsAdapter } from "./adapter.js";
import type { AgentContext } from "../types/agent-context.js";
import type {
  AnalyticsEvent,
  PageViewEvent,
  ToolCallEvent,
  AccessDeniedEvent,
  PaymentChallengedEvent,
  PaymentCompletedEvent,
  LlmReferralEvent,
  RateLimitedEvent,
} from "../types/analytics-event.js";
import type { AnalyticsConfig } from "../types/config.js";
import type { TrustTier } from "../types/trust-tier.js";

/**
 * Layer 3 — Analytics Collector
 *
 * Collects analytics events from all layers and writes them to the configured
 * storage backend in batches. The batch flush is asynchronous and never blocks
 * the HTTP response.
 *
 * Key design decisions:
 * - Events are buffered in memory and flushed on a timer (default: 5 seconds)
 * - A flush is also triggered when the batch size exceeds the configured limit
 * - If the flush fails, events are not retried (analytics loss > blocking production)
 * - The collector is a singleton per SDK instance, shared across all requests
 *
 * LLM Referral Detection:
 * Tracks human visitors arriving from AI-generated citations. Detects via the
 * Referer header from known AI platforms (perplexity.ai, claude.ai, etc.).
 */

/** Known LLM platforms that appear in Referer headers when they cite external links. */
const LLM_REFERRER_DOMAINS = new Set([
  "perplexity.ai",
  "claude.ai",
  "chat.openai.com",
  "chatgpt.com",
  "you.com",
  "phind.com",
  "bing.com", // Copilot grounded answers
  "bard.google.com",
  "gemini.google.com",
  "poe.com",
]);

/**
 * Extract the platform name from a Referer URL.
 * Returns null if the referrer is not from a known LLM platform.
 */
export function detectLlmReferral(refererHeader: string | undefined): string | null {
  if (!refererHeader) return null;

  try {
    const url = new URL(refererHeader);
    const hostname = url.hostname.replace(/^www\./, "");
    for (const domain of LLM_REFERRER_DOMAINS) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) {
        return domain;
      }
    }
  } catch {
    // Malformed referer — ignore
  }

  return null;
}

/** Helper to build the base fields common to all events from an AgentContext. */
function baseFields(
  context: AgentContext,
  statusCode: number,
  responseTimeMs: number,
): Omit<PageViewEvent, "type" | "servedMarkdown" | "markdownTokens" | "contentSignals"> {
  return {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    tier: context.tier,
    requestId: context.requestId,
    path: context.path,
    method: context.method,
    agentName: context.matchedAgent?.agentName ?? null,
    agentOperator: context.matchedAgent?.operator ?? null,
    agentCategory: context.agentCategory,
    userAgent: context.userAgent,
    signals: context.signals,
    verifiedAgentId: context.verifiedIdentity?.agentId ?? null,
    tenantId: context.tenantContext?.tenantId ?? null,
    sessionId: context.tenantContext?.sessionId ?? null,
    statusCode,
    responseTimeMs,
  };
}

export class AnalyticsCollector {
  private readonly adapter: AnalyticsAdapter;
  private readonly config: Required<
    Pick<AnalyticsConfig, "batchSize" | "flushIntervalMs" | "trackLlmReferrals">
  >;
  private buffer: AnalyticsEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(adapter: AnalyticsAdapter, config: AnalyticsConfig) {
    this.adapter = adapter;
    this.config = {
      batchSize: config.batchSize ?? 50,
      flushIntervalMs: config.flushIntervalMs ?? 5000,
      trackLlmReferrals: config.trackLlmReferrals ?? true,
    };
    this.scheduleFlush();
  }

  /** Push an event into the buffer. Triggers an immediate flush if buffer is full. */
  private push(event: AnalyticsEvent): void {
    this.buffer.push(event);
    if (this.buffer.length >= this.config.batchSize) {
      void this.flush();
    }
  }

  /** Flush the current buffer to the adapter. */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const toWrite = this.buffer;
    this.buffer = [];

    try {
      await this.adapter.writeBatch(toWrite);
    } catch (error) {
      // Log but do not rethrow — analytics loss is acceptable; breaking production is not
      console.warn(
        `[@agentfriendly/analytics] Flush failed (${toWrite.length} events lost): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private scheduleFlush(): void {
    this.flushTimer = setTimeout(() => {
      void this.flush();
      this.scheduleFlush();
    }, this.config.flushIntervalMs);

    // Do not prevent the Node.js process from exiting due to this timer
    if (this.flushTimer.unref) {
      this.flushTimer.unref();
    }
  }

  /** Track a page view (the most common event type). */
  trackPageView(
    context: AgentContext,
    statusCode: number,
    responseTimeMs: number,
    servedMarkdown: boolean,
    markdownTokens: number | null,
  ): void {
    // Also check for LLM referral on human requests
    if (!context.isAgent && this.config.trackLlmReferrals) {
      const referrerPlatform = detectLlmReferral(context.headers["referer"]);
      if (referrerPlatform) {
        this.push({
          type: "llm-referral",
          ...baseFields(context, statusCode, responseTimeMs),
          referrerPlatform,
          referrerUrl: context.headers["referer"] ?? "",
        } satisfies LlmReferralEvent);
        return; // Don't also emit a page-view for the same event
      }
    }

    this.push({
      type: "page-view",
      ...baseFields(context, statusCode, responseTimeMs),
      servedMarkdown,
      markdownTokens,
      contentSignals: null, // Populated by the caller if available
    } satisfies PageViewEvent);
  }

  /** Track a tool invocation. */
  trackToolCall(
    context: AgentContext,
    toolName: string,
    toolVersion: string,
    success: boolean,
    handlerDurationMs: number,
    errorMessage?: string,
  ): void {
    this.push({
      type: "tool-call",
      ...baseFields(context, success ? 200 : 500, handlerDurationMs),
      toolName,
      toolVersion,
      success,
      errorMessage: errorMessage ?? null,
      handlerDurationMs,
    } satisfies ToolCallEvent);
  }

  /** Track an access denial. */
  trackAccessDenied(context: AgentContext, reason: string, requiredTier: TrustTier | null): void {
    this.push({
      type: "access-denied",
      ...baseFields(context, 403, 0),
      reason,
      requiredTier,
    } satisfies AccessDeniedEvent);
  }

  /** Track an x402 payment challenge being issued. */
  trackPaymentChallenged(context: AgentContext, amountUsdc: number, network: string): void {
    this.push({
      type: "payment-challenged",
      ...baseFields(context, 402, 0),
      amountUsdc,
      network,
    } satisfies PaymentChallengedEvent);
  }

  /** Track a successful x402 payment. */
  trackPaymentCompleted(
    context: AgentContext,
    amountUsdc: number,
    network: string,
    proofHash: string,
  ): void {
    this.push({
      type: "payment-completed",
      ...baseFields(context, 200, 0),
      amountUsdc,
      network,
      proofHash,
    } satisfies PaymentCompletedEvent);
  }

  /** Track a rate limit being hit. */
  trackRateLimited(context: AgentContext, limitRule: string, requestCount: number): void {
    this.push({
      type: "rate-limited",
      ...baseFields(context, 429, 0),
      limitRule,
      requestCount,
    } satisfies RateLimitedEvent);
  }

  /** Flush and close the adapter. Call on server shutdown. */
  async close(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
    await this.adapter.close();
  }
}
