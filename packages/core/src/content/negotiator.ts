import micromatch from "micromatch";

import { htmlToMarkdown } from "./html-to-markdown.js";

import type { AgentContext } from "../types/agent-context.js";
import type { PassthroughResponse } from "../types/agent-response.js";
import type { ContentConfig } from "../types/config.js";


/**
 * Layer 2 — Content Negotiator
 *
 * Decides whether to serve a markdown response and, if so, performs the conversion.
 *
 * Decision logic:
 * 1. Is this request for a discovery path? (Handled by Layer 1 — skip)
 * 2. Is this an agent request? (tier !== "human")
 * 3. Should we serve markdown for this tier? (proactiveMarkdown config + requestedMarkdown flag)
 * 4. Is this path excluded from markdown conversion? (excludeFromMarkdown patterns)
 * 5. If all checks pass → convert and serve markdown
 * 6. Otherwise → passthrough with content signal headers injected
 *
 * The Content-Signal response headers are always injected for agent requests,
 * regardless of whether markdown is served.
 */

/** Paths never converted to markdown (always JSON APIs). */
const ALWAYS_EXCLUDE_PATTERNS = [
  "**/*.json",
  "**/api/**",
];

/**
 * Build the `content-signal` HTTP response header value.
 * Format: "ai-train=no, ai-input=yes, search=yes"
 */
export function buildContentSignalHeader(
  signals: ContentConfig["signals"],
): string {
  const aiTrain = signals?.["ai-train"] ?? false;
  const aiInput = signals?.["ai-input"] ?? true;
  const search = signals?.["search"] ?? true;

  return [
    `ai-train=${aiTrain ? "yes" : "no"}`,
    `ai-input=${aiInput ? "yes" : "no"}`,
    `search=${search ? "yes" : "no"}`,
  ].join(", ");
}

/**
 * Determine whether the agent context and config call for serving markdown.
 *
 * This encapsulates the logic described in ADR-008:
 * - "known"     (default): serve markdown to known-agent and above
 * - "suspected": also serve to suspected-agent tier
 * - "verified":  only serve to verified-agent tier
 * - false:       only serve when requestedMarkdown is true (explicit Accept header)
 */
export function shouldServeMarkdown(
  context: AgentContext,
  config: ContentConfig,
  proactiveMarkdown: "known" | "suspected" | "verified" | false = "known",
): boolean {
  if (!context.isAgent) return false;
  if (config.markdown === false) return false;

  // Always honor the explicit Accept: text/markdown request
  if (context.requestedMarkdown) return true;

  // Apply proactive markdown policy
  switch (proactiveMarkdown) {
    case "verified":
      return context.tier === "verified-agent";
    case "known":
      return context.tier === "known-agent" || context.tier === "verified-agent";
    case "suspected":
      return (
        context.tier === "suspected-agent" ||
        context.tier === "known-agent" ||
        context.tier === "verified-agent"
      );
    case false:
      return false;
    default:
      return false;
  }
}

/**
 * Determine whether a given URL path should be excluded from markdown conversion.
 * Checks both the built-in exclusion patterns and any user-configured patterns.
 */
export function isExcludedFromMarkdown(path: string, userExcluded: string[] = []): boolean {
  const allPatterns = [...ALWAYS_EXCLUDE_PATTERNS, ...userExcluded];
  return micromatch.isMatch(path, allPatterns);
}

/**
 * Process the HTML body of an existing response and return it as markdown.
 * This function is called by the framework adapters after the route handler
 * has produced its response, when the content layer needs to convert it.
 *
 * Returns null if conversion should not be applied (path excluded, content
 * already non-HTML, etc.).
 */
export interface MarkdownResponse {
  readonly markdown: string;
  readonly title: string;
  readonly estimatedTokens: number;
}

export async function convertResponseToMarkdown(
  htmlBody: string,
  requestUrl: string,
  additionalStripSelectors: string[],
): Promise<MarkdownResponse> {
  const result = await htmlToMarkdown(htmlBody, requestUrl, additionalStripSelectors);
  return {
    markdown: result.markdown,
    title: result.title,
    estimatedTokens: result.estimatedTokens,
  };
}

/**
 * Build the set of headers to inject into all agent responses.
 * This includes Content-Signal headers and debug headers.
 * Does not include markdown-specific headers (those are added by the converter).
 */
export function buildAgentResponseHeaders(
  context: AgentContext,
  config: ContentConfig,
  debugMode: boolean,
): Record<string, string> {
  const headers: Record<string, string> = {};

  // Always inject Content-Signal headers for agent requests
  if (context.isAgent) {
    headers["content-signal"] = buildContentSignalHeader(config.signals);
  }

  // Inject debug headers when debug mode is on
  if (debugMode) {
    headers["x-agentfriendly-tier"] = context.tier;
    headers["x-agentfriendly-request-id"] = context.requestId;
    headers["x-agentfriendly-signals"] = context.signals.join(",");
    headers["x-agentfriendly-detection-reason"] = context.tierResolution.reason;
    if (context.matchedAgent) {
      headers["x-agentfriendly-agent-name"] = context.matchedAgent.agentName;
      headers["x-agentfriendly-agent-operator"] = context.matchedAgent.operator;
    }
  }

  return headers;
}

/**
 * Build a PassthroughResponse that injects the agent headers without converting content.
 * Used when the request is agent traffic but no content conversion is needed
 * (e.g., the path is excluded from markdown, or it's an API endpoint).
 */
export function buildPassthroughWithHeaders(
  context: AgentContext,
  config: ContentConfig,
  debugMode: boolean,
): PassthroughResponse {
  return {
    handled: false,
    injectHeaders: buildAgentResponseHeaders(context, config, debugMode),
  };
}
