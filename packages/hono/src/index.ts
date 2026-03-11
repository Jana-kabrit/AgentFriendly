/**
 * @agentfriendly/hono
 *
 * Hono adapter for the @agentfriendly SDK.
 * Optimized for Cloudflare Workers and edge environments.
 *
 * @example
 * ```typescript
 * import { Hono } from "hono"
 * import { createAgentFriendlyMiddleware, getAgentContext } from "@agentfriendly/hono"
 *
 * const app = new Hono()
 *
 * app.use("*", createAgentFriendlyMiddleware({
 *   detection: { proactiveMarkdown: "known" },
 * }))
 *
 * export default app
 * ```
 */
export { createAgentFriendlyMiddleware, getAgentContext } from "./adapter.js";

export {
  issueDelegationToken,
  revokeSession,
} from "@agentfriendly/core";
export type {
  AgentFriendlyConfig,
  AgentContext,
  TrustTier,
  ToolDefinition,
} from "@agentfriendly/core";
