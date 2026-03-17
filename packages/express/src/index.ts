/**
 * @agentfriendly/express
 *
 * Express.js adapter for the @agentfriendly SDK.
 *
 * @example
 * ```typescript
 * import express from "express"
 * import { createAgentFriendlyMiddleware } from "@agentfriendly/express"
 *
 * const app = express()
 *
 * app.use(createAgentFriendlyMiddleware({
 *   detection: { proactiveMarkdown: "known" },
 *   content: { markdown: true },
 * }))
 * ```
 */
export { createAgentFriendlyMiddleware } from "./adapter.js";

export { getAgentContext, issueDelegationToken, revokeSession } from "@agentfriendly/core";
export type {
  AgentFriendlyConfig,
  AgentContext,
  TrustTier,
  ToolDefinition,
} from "@agentfriendly/core";
