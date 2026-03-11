/**
 * @agentfriendly/ua-database
 *
 * Versioned database of known AI agent user-agents.
 * Shared between the TypeScript and Python @agentfriendly SDKs.
 *
 * @example
 * ```typescript
 * import { matchUserAgent, getAllAgents, getDatabaseVersion } from "@agentfriendly/ua-database"
 *
 * const match = matchUserAgent("GPTBot/1.0")
 * if (match) {
 *   console.log(match.entry.agentName)    // "GPTBot"
 *   console.log(match.entry.category)    // "training-crawler"
 *   console.log(match.entry.operator)    // "OpenAI"
 *   console.log(match.confidence)         // "high"
 * }
 *
 * console.log(getDatabaseVersion()) // "1.0.0"
 * ```
 */
export { matchUserAgent, getAllAgents, getDatabaseVersion, getAgentsByCategory } from "./loader.js";
export type { AgentEntry, AgentDatabase, AgentCategory, MatchType, UaMatch } from "./types.js";
