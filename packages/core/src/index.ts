/**
 * @agentfriendly/core
 *
 * Framework-agnostic core for the @agentfriendly SDK.
 * Contains all 8 layers of agent-friendly web infrastructure.
 *
 * Framework adapters import from this package and translate their
 * native request/response types to the AgentRequest/AgentResponse interface.
 *
 * @example
 * ```typescript
 * // Direct usage (framework-agnostic)
 * import { AgentFriendlyMiddleware, getAgentContext } from "@agentfriendly/core"
 *
 * const middleware = new AgentFriendlyMiddleware({
 *   detection: { proactiveMarkdown: "known" },
 *   content: { markdown: true },
 * })
 * ```
 */

// Main middleware orchestrator
export { AgentFriendlyMiddleware, getAgentContext, agentContextStorage } from "./middleware.js";
export type { OrchestratorResult, ContentInstructions } from "./middleware.js";

// Config
export { resolveConfig } from "./config.js";

// Layer 0: Detection
export {
  runDetectionPipeline,
  analyzeAcceptHeader,
  checkUaDatabase,
  runHeaderHeuristics,
  verifyRfc9421Signature,
  verifyClawdentityToken,
} from "./detection/index.js";

// Layer 1: Discovery
export {
  generateLlmsTxt,
  generateAgentJson,
  generateWebagentsMd,
  generateAgentToolsJson,
  isDiscoveryPath,
  serveDiscoveryFile,
} from "./discovery/index.js";

// Layer 2: Content
export {
  htmlToMarkdown,
  estimateTokenCount,
  buildContentSignalHeader,
  shouldServeMarkdown,
  isExcludedFromMarkdown,
  convertResponseToMarkdown,
} from "./content/index.js";

// Layer 3: Analytics
export {
  AnalyticsCollector,
  detectLlmReferral,
  NullAnalyticsAdapter,
  WebhookAnalyticsAdapter,
} from "./analytics/index.js";

// Layer 4: Access Control
export {
  evaluatePolicy,
  meetsMinimumTier,
  generateRobotsTxtAiSection,
  InMemoryRateLimiter,
  getRateLimitKey,
} from "./access/index.js";

// Layer 5: Privacy
export {
  maskTextContent,
  maskJsonFields,
  BUILT_IN_PII_PATTERNS,
} from "./privacy/index.js";

// Layer 6: Tools
export { ToolRegistry, InMemoryTaskQueue } from "./tools/index.js";

// Layer 7: Monetization
export {
  checkMonetization,
  findMatchingPricing,
  generate402Response,
  verifyPaymentProof,
} from "./monetization/index.js";

// Layer 8: Multi-Tenancy
export {
  issueDelegationToken,
  validateDelegationToken,
  revokeSession,
  isSessionRevoked,
  getCrl,
  loadCrl,
} from "./multitenancy/index.js";

// All Types
export type {
  // Trust Tier
  TrustTier,
  DetectionSignal,
  TierResolution,
  // Agent Context
  AgentContext,
  AgentContextBuilder,
  VerifiedIdentity,
  TenantContext,
  TraceEntry,
  // Config
  AgentFriendlyConfig,
  ResolvedConfig,
  DetectionConfig,
  DiscoveryConfig,
  ContentConfig,
  AnalyticsConfig,
  AccessConfig,
  PrivacyConfig,
  ToolsConfig,
  MonetizationConfig,
  MultiTenancyConfig,
  // Tools
  ToolDefinition,
  ToolInputSchema,
  ToolHandler,
  RegisteredTool,
  TaskHandlerDefinition,
  Task,
  TaskStatus,
  // Analytics Events
  AnalyticsEvent,
  AnalyticsEventType,
  PageViewEvent,
  ToolCallEvent,
  // Adapters
  AnalyticsAdapter,
  // Request/Response
  AgentRequest,
  AgentResponse,
  HandledResponse,
  PassthroughResponse,
  // UA Database
  AgentEntry,
  AgentCategory,
  UaMatch,
} from "./types/index.js";
