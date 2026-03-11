import type { TrustTier, DetectionSignal } from "./trust-tier.js";
import type { AgentCategory } from "@agentfriendly/ua-database";

/**
 * The type of analytics event. Each event type maps to a distinct row in the
 * analytics storage and has its own set of metadata fields.
 */
export type AnalyticsEventType =
  /** An agent or human accessed a page/route. The most common event type. */
  | "page-view"
  /** An agent called a registered tool via the tool manifest. */
  | "tool-call"
  /** An agent was denied access to a restricted route. */
  | "access-denied"
  /** An x402 payment challenge was issued. */
  | "payment-challenged"
  /** An x402 payment was successfully verified and accepted. */
  | "payment-completed"
  /** A human visitor arrived via a link cited by an AI (LLM referral). */
  | "llm-referral"
  /** An agent's identity was cryptographically verified. */
  | "identity-verified"
  /** A multi-tenant agent session was created. */
  | "session-created"
  /** A multi-tenant agent session was revoked. */
  | "session-revoked"
  /** A rate limit was hit by an agent. */
  | "rate-limited";

/** Metadata common to all event types. */
interface BaseEvent {
  /** Unique event ID. Used for deduplication in analytics storage. */
  readonly eventId: string;
  /** ISO 8601 timestamp when the event occurred. */
  readonly timestamp: string;
  /** The trust tier of the request that produced this event. */
  readonly tier: TrustTier;
  /** The request ID that produced this event. Correlates with other events in the same request. */
  readonly requestId: string;
  /** The URL path of the request. */
  readonly path: string;
  /** The HTTP method of the request. */
  readonly method: string;
  /** Agent name from the UA database, if matched. */
  readonly agentName: string | null;
  /** Agent operator from the UA database, if matched. */
  readonly agentOperator: string | null;
  /** Agent category from the UA database, if matched. */
  readonly agentCategory: AgentCategory | null;
  /** Raw user-agent string. */
  readonly userAgent: string;
  /** All signals that fired for this request. */
  readonly signals: readonly DetectionSignal[];
  /** Verified agent ID (from RFC 9421 key ID or Clawdentity DID), if verified. */
  readonly verifiedAgentId: string | null;
  /** Tenant ID if this was a multi-tenant request. */
  readonly tenantId: string | null;
  /** Session ID if this was a multi-tenant request. */
  readonly sessionId: string | null;
  /** Response HTTP status code. */
  readonly statusCode: number;
  /** Response time in milliseconds. */
  readonly responseTimeMs: number;
}

/** A request for a page or API route that served content. */
export interface PageViewEvent extends BaseEvent {
  readonly type: "page-view";
  /** Whether the response was served as markdown (true) or HTML/JSON (false). */
  readonly servedMarkdown: boolean;
  /** Estimated token count if markdown was served, from the x-markdown-tokens header. */
  readonly markdownTokens: number | null;
  /** The content signal declarations included in the response. */
  readonly contentSignals: Record<string, boolean> | null;
}

/** An agent called a registered tool. */
export interface ToolCallEvent extends BaseEvent {
  readonly type: "tool-call";
  /** The name of the tool that was called. */
  readonly toolName: string;
  /** The version of the tool that was called. */
  readonly toolVersion: string;
  /** Whether the call succeeded. */
  readonly success: boolean;
  /** Error message if the call failed. */
  readonly errorMessage: string | null;
  /** Duration of the tool handler execution in milliseconds. */
  readonly handlerDurationMs: number;
}

/** An agent was denied access to a route. */
export interface AccessDeniedEvent extends BaseEvent {
  readonly type: "access-denied";
  /** Human-readable reason for the denial (e.g., "route-blocked", "tier-insufficient"). */
  readonly reason: string;
  /** The minimum tier required to access this route. */
  readonly requiredTier: TrustTier | null;
}

/** An x402 payment challenge was issued. */
export interface PaymentChallengedEvent extends BaseEvent {
  readonly type: "payment-challenged";
  /** The amount required, in USDC. */
  readonly amountUsdc: number;
  /** The network the payment must be made on. */
  readonly network: string;
}

/** An x402 payment was verified and the request was allowed through. */
export interface PaymentCompletedEvent extends BaseEvent {
  readonly type: "payment-completed";
  /** The amount paid, in USDC. */
  readonly amountUsdc: number;
  /** The network the payment was made on. */
  readonly network: string;
  /** The payment proof hash (first 16 chars), for reference. */
  readonly proofHash: string;
}

/** A human visitor arrived via an LLM citation link. */
export interface LlmReferralEvent extends BaseEvent {
  readonly type: "llm-referral";
  /** The source LLM platform (e.g., "perplexity.ai", "claude.ai", "chat.openai.com"). */
  readonly referrerPlatform: string;
  /** The full referrer URL. */
  readonly referrerUrl: string;
}

/** Agent identity was cryptographically verified. */
export interface IdentityVerifiedEvent extends BaseEvent {
  readonly type: "identity-verified";
  /** The verification method used. */
  readonly method: "rfc9421" | "clawdentity";
  /** The verified agent ID. */
  readonly verifiedAgentId: string;
}

/** A rate limit was hit. */
export interface RateLimitedEvent extends BaseEvent {
  readonly type: "rate-limited";
  /** The rate limit rule that was hit (e.g., "100/minute/agent"). */
  readonly limitRule: string;
  /** How many requests were made in the window. */
  readonly requestCount: number;
}

/** A multi-tenant agent session was created. */
export interface SessionCreatedEvent extends BaseEvent {
  readonly type: "session-created";
  readonly tenantId: string;
  readonly userId: string;
  readonly sessionId: string;
  readonly expiresAt: string;
}

/** A multi-tenant agent session was revoked. */
export interface SessionRevokedEvent extends BaseEvent {
  readonly type: "session-revoked";
  readonly tenantId: string;
  readonly sessionId: string;
  readonly reason: string;
}

/** Discriminated union of all analytics event types. */
export type AnalyticsEvent =
  | PageViewEvent
  | ToolCallEvent
  | AccessDeniedEvent
  | PaymentChallengedEvent
  | PaymentCompletedEvent
  | LlmReferralEvent
  | IdentityVerifiedEvent
  | RateLimitedEvent
  | SessionCreatedEvent
  | SessionRevokedEvent;
