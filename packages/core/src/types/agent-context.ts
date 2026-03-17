import type { TrustTier, TierResolution, DetectionSignal } from "./trust-tier.js";
import type { AgentEntry, AgentCategory } from "@agentfriendly/ua-database";

/**
 * Verified identity of an agent, available only when the trust tier is "verified-agent".
 * Populated from either an RFC 9421 HTTP Message Signature or a Clawdentity AIT.
 */
export interface VerifiedIdentity {
  /**
   * The method used to verify identity.
   * "rfc9421" = HTTP Message Signature; "clawdentity" = Agent Identity Token.
   */
  readonly method: "rfc9421" | "clawdentity";
  /** The agent's operator domain (from the key ID URL in RFC 9421, or `operator_url` in AIT). */
  readonly operatorDomain: string;
  /**
   * The agent's stable identifier.
   * For RFC 9421: the key ID URL (e.g., "https://anthropic.com/.well-known/agent-key/claude-code").
   * For Clawdentity: the DID (e.g., "did:clawdentity:agent:anthropic:claude-code").
   */
  readonly agentId: string;
  /** Permission scopes declared by the agent (from AIT claims, if present). */
  readonly scopes: readonly string[];
  /** Raw JWT claims if Clawdentity was used. Undefined for RFC 9421. */
  readonly aitClaims?: Record<string, unknown>;
}

/**
 * Multi-tenant context, populated by Layer 8 when the request carries a valid
 * agent delegation token (RFC 8693 token exchange).
 * Scopes all downstream processing (PII masking, DB queries, tool access) to this tenant.
 */
export interface TenantContext {
  /** Stable identifier of the tenant (e.g., organization or workspace ID). */
  readonly tenantId: string;
  /** The user on whose behalf the agent is acting, within this tenant. */
  readonly userId: string;
  /**
   * The scopes granted to this agent for this user+tenant combination.
   * These are checked by the tool registry and access control layer.
   */
  readonly grantedScopes: readonly string[];
  /**
   * ISO 8601 expiry timestamp for this delegation.
   * After this time, the token is invalid and a new delegation must be initiated.
   */
  readonly expiresAt: string;
  /**
   * Stable identifier of this agent session.
   * Used as the foreign key for all analytics events and audit log entries in this session.
   */
  readonly sessionId: string;
}

/**
 * AgentContext is the central object threaded through every layer of the middleware pipeline.
 * It is created fresh for each request by Layer 0 (detection) and passed immutably
 * through all subsequent layers.
 *
 * Framework adapters expose it via `AsyncLocalStorage` so any code in the call stack
 * can read it without prop-drilling:
 *
 * ```typescript
 * import { getAgentContext } from "@agentfriendly/core"
 * const ctx = getAgentContext() // returns AgentContext | null
 * ```
 */
export interface AgentContext {
  /**
   * Unique ID for this specific request-response cycle.
   * Used to correlate analytics events, audit log entries, and debug traces.
   */
  readonly requestId: string;

  /** ISO 8601 timestamp of when this request was received. */
  readonly receivedAt: string;

  /**
   * The resolved trust tier for this request.
   * This is the most important field — all layers branch on this value.
   */
  readonly tier: TrustTier;

  /** Full resolution metadata: all signals, reason string. */
  readonly tierResolution: TierResolution;

  /**
   * Whether this request is classified as an agent (any tier above "human").
   * Convenience boolean for the most common branch in middleware logic.
   */
  readonly isAgent: boolean;

  /** Raw user-agent string from the request. */
  readonly userAgent: string;

  /** The matched UA database entry, if any. Null for human and unmatched suspected-agent requests. */
  readonly matchedAgent: AgentEntry | null;

  /**
   * The category of the matched agent, if known.
   * Null for human requests and unmatched suspected-agent requests.
   */
  readonly agentCategory: AgentCategory | null;

  /**
   * All detection signals that fired for this request.
   * Stored separately from tierResolution for convenient querying.
   */
  readonly signals: readonly DetectionSignal[];

  /**
   * Verified identity, populated when tier === "verified-agent".
   * Null for all other tiers — do not read without checking tier first.
   */
  readonly verifiedIdentity: VerifiedIdentity | null;

  /**
   * Multi-tenant context, populated when a valid RFC 8693 delegation token is present.
   * Null when no delegation token was provided (the common case for public API access).
   */
  readonly tenantContext: TenantContext | null;

  /**
   * Whether the client explicitly requested markdown via `Accept: text/markdown`.
   * When false, markdown may still be served based on the trust tier and
   * the `detection.proactiveMarkdown` configuration setting.
   */
  readonly requestedMarkdown: boolean;

  /**
   * The URL path of the current request, normalized (no trailing slash, lowercase).
   * Used by access control and tool routing layers.
   */
  readonly path: string;

  /** HTTP method of the request (uppercase). */
  readonly method: string;

  /**
   * All request headers as a plain object (lowercase keys).
   * Headers are captured once at the start of the pipeline and shared read-only.
   */
  readonly headers: Readonly<Record<string, string>>;

  /**
   * Debug trace entries, populated when `debug: true` is set in config.
   * Each layer appends a trace entry describing what it did and why.
   * Exposed via `X-AgentFriendly-Trace` response header in debug mode.
   */
  readonly trace: readonly TraceEntry[];
}

/** A single trace entry from one layer of the processing pipeline. */
export interface TraceEntry {
  /** Which layer produced this entry (e.g., "Layer0:Detection", "Layer2:Content"). */
  readonly layer: string;
  /** Human-readable description of what this layer did. */
  readonly action: string;
  /** How long this layer took in milliseconds. */
  readonly durationMs: number;
}

/**
 * Mutable builder used internally to construct AgentContext.
 * The public AgentContext is always readonly — this type is only used
 * within the detection pipeline to build the object incrementally.
 * @internal
 */
export interface AgentContextBuilder {
  requestId: string;
  receivedAt: string;
  tier: TrustTier;
  tierResolution: TierResolution;
  isAgent: boolean;
  userAgent: string;
  matchedAgent: AgentEntry | null;
  agentCategory: AgentCategory | null;
  signals: DetectionSignal[];
  verifiedIdentity: VerifiedIdentity | null;
  tenantContext: TenantContext | null;
  requestedMarkdown: boolean;
  path: string;
  method: string;
  headers: Record<string, string>;
  trace: TraceEntry[];
}
