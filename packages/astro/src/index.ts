/**
 * @agentfriendly/astro
 *
 * Astro integration and middleware for the @agentfriendly SDK.
 *
 * @example
 * ```typescript
 * // src/middleware.ts (Astro project)
 * import { createAgentFriendlyMiddleware } from "@agentfriendly/astro"
 *
 * export const onRequest = createAgentFriendlyMiddleware({
 *   detection: { proactiveMarkdown: "known" },
 *   content: { markdown: true },
 * })
 * ```
 */
export { createAgentFriendlyMiddleware } from "./middleware.js";
export { agentFriendlyIntegration, agentFriendlyIntegration as default } from "./integration.js";

export { getAgentContext, issueDelegationToken, revokeSession } from "@agentfriendly/core";
export type {
  AgentFriendlyConfig,
  AgentContext,
  TrustTier,
  ToolDefinition,
} from "@agentfriendly/core";
