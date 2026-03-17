/**
 * @agentfriendly/nuxt
 *
 * Nuxt 3 module for the @agentfriendly SDK.
 *
 * @example
 * ```typescript
 * // nuxt.config.ts
 * export default defineNuxtConfig({
 *   modules: ["@agentfriendly/nuxt"],
 *   agentFriendly: {
 *     detection: { proactiveMarkdown: "known" },
 *     content: { markdown: true },
 *   },
 * })
 * ```
 */
export { default } from "./module.js";
export type { ModuleOptions } from "./module.js";

export { createH3Middleware, defineAgentFriendlyHandler } from "./server-middleware.js";

export { getAgentContext, issueDelegationToken, revokeSession } from "@agentfriendly/core";
export type {
  AgentFriendlyConfig,
  AgentContext,
  TrustTier,
  ToolDefinition,
} from "@agentfriendly/core";
