import micromatch from "micromatch";

import type { AgentContext } from "../types/agent-context.js";
import type { AccessConfig, AgentTypePolicy } from "../types/config.js";
import type { TrustTier } from "../types/trust-tier.js";

/**
 * Layer 4 — Access Control Policy Engine
 *
 * Evaluates whether an agent request should be allowed, denied, or challenged.
 *
 * Evaluation order (most specific wins):
 * 1. Verified identity operator overrides (e.g., deny a specific company)
 * 2. Per-agent-category overrides (e.g., deny all training-crawlers)
 * 3. Route-level allow/deny rules (glob patterns)
 * 4. Suspected-agent policy (default: allow-public — cautious but not blocking)
 * 5. Default: allow
 *
 * Also enforces minimum trust tier for routes marked `verified-only`.
 *
 * robots.txt Generation:
 * The policy engine generates the AI section of robots.txt at startup from
 * the configured agent type policies. The robots.txt is then served at /robots.txt
 * by the framework adapter (it is appended to any existing robots.txt content).
 */

export type PolicyDecision = "allow" | "deny" | "rate-limit";

export interface PolicyEvaluationResult {
  readonly decision: PolicyDecision;
  readonly reason: string;
  /**
   * HTTP status code to return for non-allow decisions.
   * 403 for deny, 429 for rate-limit.
   */
  readonly statusCode: 403 | 429 | null;
}

const ALLOW: PolicyEvaluationResult = {
  decision: "allow",
  reason: "No matching deny rules",
  statusCode: null,
};

function denyResult(reason: string): PolicyEvaluationResult {
  return { decision: "deny", reason, statusCode: 403 };
}

function rateLimitResult(reason: string): PolicyEvaluationResult {
  return { decision: "rate-limit", reason, statusCode: 429 };
}

/**
 * Evaluate the access policy for an incoming agent request.
 * Returns the policy decision and the reason for it.
 */
export function evaluatePolicy(
  context: AgentContext,
  config: AccessConfig,
): PolicyEvaluationResult {
  // Human requests are never blocked by agent access control
  if (!context.isAgent) return ALLOW;

  const path = context.path;

  // 1. Per-operator overrides (checked first — most specific)
  if (config.operators && context.matchedAgent) {
    const operatorPolicy = config.operators[context.matchedAgent.operator];
    if (operatorPolicy) {
      const result = applyAgentPolicy(operatorPolicy, path, config.allow ?? []);
      if (result) return result;
    }
  }

  // 2. Per-agent-category overrides
  if (config.agentTypes && context.agentCategory) {
    const categoryPolicy = config.agentTypes[context.agentCategory];
    if (categoryPolicy) {
      const result = applyAgentPolicy(categoryPolicy, path, config.allow ?? []);
      if (result) return result;
    }
  }

  // 3. Suspected-agent policy (default: allow-public, which means check route rules)
  if (context.tier === "suspected-agent" && config.agentTypes?.["suspected-agent"]) {
    const result = applyAgentPolicy(
      config.agentTypes["suspected-agent"],
      path,
      config.allow ?? [],
    );
    if (result) return result;
  }

  // 4. Route-level deny rules (glob patterns)
  const denyPatterns = config.deny ?? [];
  if (denyPatterns.length > 0 && micromatch.isMatch(path, denyPatterns)) {
    // Check if the path is in an explicit allow list (allow takes precedence over deny)
    const allowPatterns = config.allow ?? [];
    if (allowPatterns.length > 0 && micromatch.isMatch(path, allowPatterns)) {
      return ALLOW;
    }
    return denyResult(`Path "${path}" matches deny pattern`);
  }

  return ALLOW;
}

/**
 * Apply a named agent policy to a specific path.
 * Returns null if the policy allows the request (caller should continue evaluation).
 * Returns a PolicyEvaluationResult if the policy produces a definitive decision.
 */
function applyAgentPolicy(
  policy: AgentTypePolicy,
  path: string,
  allowPatterns: string[],
): PolicyEvaluationResult | null {
  switch (policy) {
    case "deny-all":
      return denyResult(`Agent type policy: deny-all`);
    case "allow-all":
      return null; // Explicitly allowed — continue (do not return early)
    case "allow-public": {
      // "allow-public" means: allow access to routes that are not explicitly denied.
      // If this agent is on "allow-public" and hits a path that the allow list
      // explicitly covers, allow it. Otherwise, default behavior applies.
      if (allowPatterns.length > 0 && !micromatch.isMatch(path, allowPatterns)) {
        return denyResult(`Agent type policy: allow-public — path not in allow list`);
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * Check whether a request meets the minimum trust tier requirement for a route.
 * Used by the tool registry to enforce `minTier: "verified-agent"` on tools.
 */
export function meetsMinimumTier(
  actualTier: TrustTier,
  requiredTier: TrustTier,
): boolean {
  const tierOrder: Record<TrustTier, number> = {
    human: 0,
    "suspected-agent": 1,
    "known-agent": 2,
    "verified-agent": 3,
  };
  return (tierOrder[actualTier] ?? 0) >= (tierOrder[requiredTier] ?? 0);
}

// ---------------------------------------------------------------------------
// robots.txt Generation
// ---------------------------------------------------------------------------

/**
 * User-agents for each category that are commonly seen in the wild.
 * Used to generate the AI section of robots.txt from the access config.
 */
const CATEGORY_UA_REPRESENTATIVES: Record<string, string[]> = {
  "training-crawler": [
    "GPTBot",
    "ClaudeBot",
    "Google-Extended",
    "CCBot",
    "Bytespider",
    "anthropic-ai",
    "Meta-ExternalAgent",
    "Amazonbot",
    "Applebot-Extended",
    "cohere-ai",
    "AI2Bot",
  ],
  "search-bot": [
    "OAI-SearchBot",
    "ChatGPT-User",
    "PerplexityBot",
    "YouBot",
    "DuckAssistBot",
  ],
  "interactive-agent": [
    "GoogleAgent-URLContext",
    "Claude-Web",
    "Claude-SearchBot",
  ],
};

/**
 * Generate the AI/agent section of robots.txt from the access configuration.
 *
 * This covers training crawlers and search bots — the ones that respect robots.txt.
 * Interactive agents making real-time requests do not always check robots.txt,
 * so route-level access control (above) is the more reliable enforcement mechanism.
 */
export function generateRobotsTxtAiSection(config: AccessConfig): string {
  const lines: string[] = [
    "# AI Agent Access Control — generated by @agentfriendly",
    "# Modify these rules via the access.agentTypes config in agentfriendly.config.ts",
    "",
  ];

  for (const [category, policy] of Object.entries(config.agentTypes ?? {})) {
    const representatives = CATEGORY_UA_REPRESENTATIVES[category] ?? [];
    if (representatives.length === 0) continue;

    lines.push(`# ${category} — policy: ${policy}`);
    for (const ua of representatives) {
      lines.push(`User-agent: ${ua}`);
    }

    switch (policy) {
      case "deny-all":
        lines.push("Disallow: /");
        break;
      case "allow-public": {
        // Allow everything except explicitly denied paths
        const deniedPaths = (config.deny ?? []).filter(
          (p) => !p.includes("*"), // Only include simple paths in robots.txt (no glob)
        );
        if (deniedPaths.length > 0) {
          for (const path of deniedPaths) {
            lines.push(`Disallow: ${path}`);
          }
        } else {
          lines.push("Allow: /");
        }
        break;
      }
      case "allow-all":
        lines.push("Allow: /");
        break;
    }
    lines.push("");
  }

  return lines.join("\n");
}
