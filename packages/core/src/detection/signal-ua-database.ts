import { matchUserAgent } from "@agentfriendly/ua-database";

import type { DetectionSignal } from "../types/trust-tier.js";
import type { UaMatch } from "@agentfriendly/ua-database";


/**
 * SIGNAL 2: User-Agent Database Lookup
 *
 * Matches the incoming User-Agent string against the @agentfriendly/ua-database.
 * This is the highest-value signal: a match with high confidence almost certainly
 * means the request is from an AI agent.
 *
 * Coverage: As of March 2026, the database covers 30+ agents including all major
 * LLM providers (OpenAI, Anthropic, Google, Meta, ByteDance), search bots
 * (Perplexity, You.com, DuckDuckGo), and interactive agents (Claude Code, Windsurf).
 */

/** Result of checking the User-Agent against the database. */
export interface UaDatabaseResult {
  /** Whether a match was found. */
  readonly matched: boolean;
  /** The full match result if found, including the entry and confidence level. */
  readonly match: UaMatch | null;
  /** The signals that fired as a result of this analysis. */
  readonly signals: readonly DetectionSignal[];
}

/**
 * Check the User-Agent string against the agent database.
 * Also checks a list of custom agent patterns provided in the SDK configuration.
 */
export function checkUaDatabase(
  userAgent: string | undefined,
  customAgents?: string[],
): UaDatabaseResult {
  if (!userAgent) {
    return { matched: false, match: null, signals: [] };
  }

  // First check the official database
  const dbMatch = matchUserAgent(userAgent);
  if (dbMatch) {
    return { matched: true, match: dbMatch, signals: ["ua-database"] };
  }

  // Then check custom agent patterns from the SDK config
  if (customAgents && customAgents.length > 0) {
    for (const pattern of customAgents) {
      if (userAgent.startsWith(pattern) || userAgent === pattern) {
        // Create a synthetic UaMatch for custom agents
        const syntheticMatch: UaMatch = {
          entry: {
            pattern,
            matchType: "prefix",
            agentName: pattern,
            operator: "Custom",
            operatorUrl: null,
            category: "interactive-agent",
            description: `Custom agent defined in agentfriendly.config.ts`,
            verificationSupport: false,
            firstSeen: new Date().toISOString().slice(0, 10),
            sources: [],
          },
          confidence: "high",
        };
        return { matched: true, match: syntheticMatch, signals: ["ua-database"] };
      }
    }
  }

  return { matched: false, match: null, signals: [] };
}
