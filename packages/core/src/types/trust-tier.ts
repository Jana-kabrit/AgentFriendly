/**
 * Trust Tier — the central classification assigned to every incoming request.
 *
 * The SDK assigns one tier per request, determined by the 4-signal detection pipeline
 * (Layer 0). All downstream layers read this tier from AgentContext to make decisions
 * about content format, access control, monetization, and analytics.
 *
 * Tier ordering (ascending trust/access):
 *   human < suspected-agent < known-agent < verified-agent
 */
export type TrustTier =
  /**
   * The request appears to come from a human browser.
   * Standard HTML response; analytics still track the request for baseline comparison.
   * No agent-specific processing applies.
   */
  | "human"
  /**
   * The request shows heuristic signals of agent traffic (missing Accept-Language,
   * no Cookie header, connection pattern analysis) but did not match any UA database entry.
   * May be a novel agent, a misconfigured bot, or an automated testing tool.
   * Config option `proactiveMarkdown: "suspected"` enables markdown for this tier.
   */
  | "suspected-agent"
  /**
   * The User-Agent matched an entry in the @agentfriendly/ua-database with high or
   * medium confidence. The agent identity is known but not cryptographically verified.
   * Most agents fall into this tier. Markdown is served by default (config: "known").
   */
  | "known-agent"
  /**
   * The request carried a valid RFC 9421 HTTP Message Signature or a valid Clawdentity
   * Agent Identity Token (AIT), and the cryptographic verification passed.
   * The agent's identity is confirmed. Routes marked `verified-only` are accessible.
   * Highest trust; all access rules, PII masking, and monetization policies apply.
   */
  | "verified-agent";

/**
 * The signal source(s) that determined the trust tier.
 * A single request may satisfy multiple signals; all contributing signals are recorded.
 */
export type DetectionSignal =
  /** `Accept: text/markdown` or `Accept: application/agent+json` was present */
  | "accept-header"
  /** User-Agent matched an entry in the @agentfriendly/ua-database */
  | "ua-database"
  /** HTTP header heuristics: missing Accept-Language, no Cookie, unusual Accept patterns */
  | "header-heuristics"
  /** Request pattern analysis: high frequency, regular intervals, no JS execution */
  | "request-pattern"
  /** RFC 9421 HTTP Message Signature verification passed */
  | "rfc9421-signature"
  /** Clawdentity Agent Identity Token (AIT) verification passed */
  | "clawdentity-ait";

/** The result of the detection pipeline for a single request. */
export interface TierResolution {
  /** The resolved trust tier for this request. */
  readonly tier: TrustTier;
  /** All signals that contributed to the tier decision. */
  readonly signals: readonly DetectionSignal[];
  /**
   * Human-readable reason for the tier decision.
   * Included in debug headers (`X-AgentFriendly-Detection-Reason`) when debug mode is on.
   */
  readonly reason: string;
}
