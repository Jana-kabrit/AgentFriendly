import type { DetectionSignal } from "../types/trust-tier.js";

/**
 * SIGNAL 3: HTTP Header Heuristics
 *
 * Analyzes the full set of request headers for patterns that are common in
 * automated agents but rare in human browsers. No single heuristic is definitive,
 * so we score them and apply a threshold.
 *
 * Based on research from:
 * - Cloudflare Bot Management (header ordering analysis, 2025)
 * - Checkly's state of AI agent content negotiation report (Feb 2026)
 * - Dark Visitors documentation
 *
 * Key insight: real browsers always send certain headers (Accept-Language, Cookie
 * even if empty, etc.) and have consistent header ordering patterns. Agents that
 * build requests programmatically often miss these.
 */

interface HeuristicScore {
  readonly name: string;
  readonly fired: boolean;
  readonly weight: number;
  readonly reason: string;
}

/** Result of the header heuristics analysis. */
export interface HeaderHeuristicsResult {
  /** Whether the heuristics pass the threshold for "suspected-agent" classification. */
  readonly isSuspected: boolean;
  /** The total score (sum of weights for fired heuristics). */
  readonly totalScore: number;
  /** All heuristics that were evaluated. */
  readonly scores: readonly HeuristicScore[];
  /** The signals that fired as a result of this analysis. */
  readonly signals: readonly DetectionSignal[];
}

/** Minimum total score to classify as a suspected agent. */
const SUSPECTED_THRESHOLD = 3;

/**
 * Standard Accept headers sent by major browsers.
 * Agents rarely send the full browser accept header.
 */
const BROWSER_ACCEPT_PATTERNS = [
  "text/html,application/xhtml+xml,application/xml",
  "text/html, application/xhtml+xml, application/xml",
];

/**
 * Run header heuristics analysis on the incoming request headers.
 */
export function runHeaderHeuristics(headers: Record<string, string>): HeaderHeuristicsResult {
  const scores: HeuristicScore[] = [];

  // Heuristic 1: Missing Accept-Language header (weight: 2)
  // All real browsers send Accept-Language. Most programmatic HTTP clients do not.
  const hasAcceptLanguage = "accept-language" in headers;
  scores.push({
    name: "missing-accept-language",
    fired: !hasAcceptLanguage,
    weight: 2,
    reason: "Real browsers always send Accept-Language; programmatic clients typically do not",
  });

  // Heuristic 2: Missing Cookie header (weight: 1)
  // Browsers always send Cookie (even if empty) for previously visited sites.
  // Agents making first-time requests to a site typically do not have cookies.
  // Lower weight because first-time human visits also lack cookies.
  const hasCookie = "cookie" in headers;
  scores.push({
    name: "no-cookie",
    fired: !hasCookie,
    weight: 1,
    reason: "Missing Cookie header — first-time visit or programmatic client",
  });

  // Heuristic 3: Minimal or wildcard-only Accept header (weight: 2)
  // Real browsers send complex, specific Accept headers.
  // Agents often send only "*/*" or a simple list.
  const acceptHeader = headers["accept"] ?? "";
  const isBrowserAccept = BROWSER_ACCEPT_PATTERNS.some((p) => acceptHeader.includes(p));
  const isWildcardOnly = acceptHeader === "*/*" || acceptHeader === "";
  const isMinimalAccept =
    !isBrowserAccept && !isWildcardOnly && acceptHeader.split(",").length <= 2;
  scores.push({
    name: "minimal-accept-header",
    fired: isWildcardOnly || isMinimalAccept,
    weight: 2,
    reason: `Accept header "${acceptHeader.slice(0, 60)}" is atypical for browsers`,
  });

  // Heuristic 4: Missing or non-browser User-Agent structure (weight: 1)
  // Real browsers have long, structured UAs starting with "Mozilla/5.0".
  // Note: we give this lower weight because we already checked the UA database.
  // This catches programmatic clients with custom UAs that are not in the database.
  const ua = headers["user-agent"] ?? "";
  const looksLikeBrowser = ua.startsWith("Mozilla/5.0") && ua.includes("AppleWebKit");
  scores.push({
    name: "non-browser-ua-structure",
    fired: ua.length > 0 && !looksLikeBrowser,
    weight: 1,
    reason: "User-Agent does not match standard browser structure",
  });

  // Heuristic 5: Missing Sec-Fetch-* headers (weight: 2)
  // Chrome and Firefox send Sec-Fetch-Site, Sec-Fetch-Mode, Sec-Fetch-Dest.
  // Programmatic HTTP clients do not.
  const hasSecFetch = "sec-fetch-site" in headers || "sec-fetch-mode" in headers;
  scores.push({
    name: "no-sec-fetch-headers",
    fired: !hasSecFetch,
    weight: 2,
    reason: "Browsers send Sec-Fetch-* headers; programmatic clients do not",
  });

  // Heuristic 6: Missing Referer when it would be expected (weight: 1)
  // Navigation from one page to another typically includes a Referer.
  // Agents making direct URL requests do not have a Referer.
  // Lower weight: direct bookmark access or typed URLs also lack Referer.
  const hasReferer = "referer" in headers;
  scores.push({
    name: "no-referer",
    fired: !hasReferer,
    weight: 1,
    reason: "Missing Referer header — direct request, possibly programmatic",
  });

  // Heuristic 7: Present X-* custom headers commonly used by agents (weight: 3)
  // Some agent frameworks add custom headers. This is a strong positive signal.
  const agentCustomHeaders = [
    "x-agent-id",
    "x-agent-name",
    "x-agent-version",
    "x-model-context",
    "x-mcp-session",
  ];
  const hasAgentHeader = agentCustomHeaders.some((h) => h in headers);
  scores.push({
    name: "agent-custom-header",
    fired: hasAgentHeader,
    weight: 3,
    reason: `Custom agent header detected: ${agentCustomHeaders.find((h) => h in headers) ?? "unknown"}`,
  });

  // Calculate total score (only for fired heuristics)
  const totalScore = scores.filter((s) => s.fired).reduce((sum, s) => sum + s.weight, 0);

  const isSuspected = totalScore >= SUSPECTED_THRESHOLD;
  const signals: DetectionSignal[] = isSuspected ? ["header-heuristics"] : [];

  return { isSuspected, totalScore, scores, signals };
}
