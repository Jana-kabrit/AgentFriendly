/**
 * @agentfriendly/next
 *
 * Next.js adapter for the @agentfriendly SDK.
 * Works with Next.js 14+ App Router and Pages Router.
 * Edge Runtime compatible for the middleware layer.
 *
 * @example
 * ```typescript
 * // middleware.ts
 * import { createAgentFriendlyMiddleware } from "@agentfriendly/next"
 *
 * export const middleware = createAgentFriendlyMiddleware({
 *   detection: { proactiveMarkdown: "known" },
 *   content: { markdown: true, signals: { "ai-train": false } },
 * })
 *
 * export const config = {
 *   matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
 * }
 * ```
 */
export { createAgentFriendlyMiddleware, withAgentFriendly } from "./adapter.js";

// Re-export core types and utilities for convenience
export { getAgentContext, issueDelegationToken, revokeSession } from "@agentfriendly/core";
export type {
  AgentFriendlyConfig,
  AgentContext,
  TrustTier,
  ToolDefinition,
} from "@agentfriendly/core";
