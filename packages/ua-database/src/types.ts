/**
 * The category of an AI agent, determining how it should be treated in access control
 * and monetization policies.
 */
export type AgentCategory =
  /** Ingests content for model training. No attribution. Block these to prevent training on your content. */
  | "training-crawler"
  /** Fetches content for real-time search citations. Drives referral traffic. */
  | "search-bot"
  /** Acts on behalf of a user to complete tasks. The most common agent type in 2026. */
  | "interactive-agent"
  /** Headless browser automation. May or may not be acting on behalf of a user. */
  | "browser-agent";

/** How the pattern field should be matched against an incoming User-Agent string. */
export type MatchType =
  /** The entire User-Agent string must equal the pattern exactly (case-sensitive). */
  | "exact"
  /** The User-Agent string must start with the pattern (case-sensitive). */
  | "prefix"
  /** The pattern is a regular expression applied to the User-Agent string. */
  | "regex";

/** A single entry in the agent UA database. */
export interface AgentEntry {
  /** The user-agent string pattern to match against. */
  readonly pattern: string;
  /** How to match the pattern. */
  readonly matchType: MatchType;
  /** Human-readable name of the agent (e.g., "GPTBot", "Claude Code WebFetch"). */
  readonly agentName: string;
  /** The company or organization operating this agent (e.g., "OpenAI", "Anthropic"). */
  readonly operator: string;
  /** URL of the operator's website, or null if unknown. */
  readonly operatorUrl: string | null;
  /** The category of this agent, determining default access and monetization policies. */
  readonly category: AgentCategory;
  /** Human-readable description including important notes (e.g., does/doesn't send Accept header). */
  readonly description: string;
  /**
   * Whether this agent supports RFC 9421 HTTP Message Signature verification.
   * When true, the agent can be cryptographically verified rather than relying on UA matching.
   */
  readonly verificationSupport: boolean;
  /** ISO 8601 date (YYYY-MM-DD) when this agent was first observed in the wild. */
  readonly firstSeen: string;
  /** URLs to documentation or references supporting this database entry. */
  readonly sources: readonly string[];
}

/** The root structure of the agents.json database file. */
export interface AgentDatabase {
  readonly version: string;
  readonly lastUpdated: string;
  readonly agents: readonly AgentEntry[];
}

/** The result of matching a User-Agent string against the database. */
export interface UaMatch {
  /** The matched database entry. */
  readonly entry: AgentEntry;
  /**
   * Confidence level of this match.
   * - "high": exact or prefix match on a unique/distinctive pattern
   * - "medium": prefix match on a common pattern (e.g., "python-requests/")
   */
  readonly confidence: "high" | "medium";
}
