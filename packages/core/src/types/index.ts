/**
 * Central type exports for @agentfriendly/core.
 * All types that form the public API surface are defined or re-exported here.
 */
export type { AgentEntry, AgentCategory, UaMatch } from "@agentfriendly/ua-database";

export type { TrustTier, DetectionSignal, TierResolution } from "./trust-tier.js";

export type {
  AgentContext,
  AgentContextBuilder,
  VerifiedIdentity,
  TenantContext,
  TraceEntry,
} from "./agent-context.js";

export type {
  AgentFriendlyConfig,
  ResolvedConfig,
  DetectionConfig,
  DiscoveryConfig,
  LlmsTxtConfig,
  ContentConfig,
  ContentSignalsConfig,
  AnalyticsConfig,
  AnalyticsStorageDriver,
  AccessConfig,
  AgentTypePolicy,
  PrivacyConfig,
  ToolsConfig,
  MonetizationConfig,
  MonetizationNetwork,
  X402RouteConfig,
  MultiTenancyConfig,
  OrmAdapter,
} from "./config.js";

export type {
  ToolDefinition,
  ToolInputSchema,
  JsonSchemaProperty,
  JsonSchemaType,
  ToolPricingPolicy,
} from "./tool-definition.js";

export type {
  AnalyticsEvent,
  AnalyticsEventType,
  PageViewEvent,
  ToolCallEvent,
  AccessDeniedEvent,
  PaymentChallengedEvent,
  PaymentCompletedEvent,
  LlmReferralEvent,
  IdentityVerifiedEvent,
  RateLimitedEvent,
  SessionCreatedEvent,
  SessionRevokedEvent,
} from "./analytics-event.js";

export type { AgentRequest } from "./agent-request.js";
export type { AgentResponse, HandledResponse, PassthroughResponse } from "./agent-response.js";

// Tool implementation types (defined in tools layer, re-exported here for convenience)
export type { ToolHandler, RegisteredTool, TaskHandlerDefinition } from "../tools/registry.js";
export type { Task, TaskStatus } from "../tools/task-queue.js";

// Analytics adapter interface
export type {
  AnalyticsAdapter,
  AnalyticsQueryOptions,
  AnalyticsQueryResult,
} from "../analytics/adapter.js";
