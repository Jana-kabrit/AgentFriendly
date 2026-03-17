import type { TrustTier } from "./trust-tier.js";

// ---------------------------------------------------------------------------
// Layer 0: Detection
// ---------------------------------------------------------------------------

export interface DetectionConfig {
  /**
   * Controls when markdown is served proactively to requests that did not
   * explicitly send `Accept: text/markdown`.
   *
   * - "known"      (default) — serve to known-agent tier and above
   * - "suspected"  — also serve to suspected-agent tier (more aggressive)
   * - "verified"   — only serve when identity is cryptographically verified
   * - false        — only serve when `Accept: text/markdown` is explicitly sent
   */
  proactiveMarkdown?: "known" | "suspected" | "verified" | false;

  /**
   * Additional user-agent strings to recognize as agents beyond the UA database.
   * These are treated as "known-agent" tier with high confidence.
   * Example: ["myinternalbot/1.0", "company-monitoring-agent"]
   */
  customAgents?: string[];

  /**
   * Whether to run the HTTP header heuristics signal (missing Accept-Language, no Cookie, etc.)
   * to detect suspected agents. Disable if you have unusual internal tooling that triggers false positives.
   * Default: true
   */
  headerHeuristics?: boolean;

  /**
   * Whether to run the request pattern analysis signal.
   * Requires the analytics layer to be enabled to track request history.
   * Default: true
   */
  requestPatternAnalysis?: boolean;

  /**
   * Whether to check for `Accept: application/agent+json` as an agent detection signal.
   * Default: true
   */
  agentJsonAcceptHeader?: boolean;
}

// ---------------------------------------------------------------------------
// Layer 1: Discovery
// ---------------------------------------------------------------------------

export interface LlmsTxtConfig {
  /** The H1 title for the generated llms.txt. Default: the site's domain name. */
  title?: string;
  /** The blockquote summary for the generated llms.txt. */
  description?: string;
  /**
   * Manual page entries to include in the generated llms.txt
   * (in addition to auto-discovered routes with agentMeta annotations).
   */
  manualEntries?: Array<{
    url: string;
    description: string;
    section?: string;
  }>;
  /**
   * Routes to exclude from the auto-generated llms.txt.
   * Supports glob patterns (e.g., "/admin/**", "/internal/**").
   */
  excludeRoutes?: string[];
}

export interface DiscoveryConfig {
  /**
   * Configuration for the auto-generated /llms.txt.
   * Set to false to disable the llms.txt endpoint entirely.
   */
  llmsTxt?: LlmsTxtConfig | false;

  /**
   * Whether to serve the AHP manifest at /.well-known/agent.json.
   * Default: true
   */
  agentJson?: boolean;

  /**
   * Whether to auto-generate and serve /webagents.md from registered tools.
   * Default: true
   */
  webagentsMd?: boolean;

  /**
   * Whether to serve /.well-known/agent-tools.json with full JSON Schema v7 definitions.
   * Default: true
   */
  agentTools?: boolean;

  /**
   * AHP MODE2: configuration for the knowledge base used to answer agent questions
   * at POST /agent/converse. If omitted, MODE2 is disabled.
   */
  converseEndpoint?: {
    /**
     * Custom handler for converse requests.
     * Receives the agent's question and returns an answer.
     */
    handler: (
      question: string,
      context?: Record<string, unknown>,
    ) => Promise<{
      answer: string;
      sources?: string[];
      confidence?: number;
    }>;
  };
}

// ---------------------------------------------------------------------------
// Layer 2: Content
// ---------------------------------------------------------------------------

export interface ContentSignalsConfig {
  /**
   * May this site's content be used for LLM training/fine-tuning?
   * Default: false (opt-out of training by default)
   */
  "ai-train"?: boolean;
  /**
   * May this site's content be used for real-time retrieval (RAG, context injection)?
   * Default: true
   */
  "ai-input"?: boolean;
  /**
   * May this site's content be used for traditional search indexing?
   * Default: true
   */
  search?: boolean;
}

export interface ContentConfig {
  /**
   * Whether to enable the HTML→markdown conversion pipeline.
   * Default: true
   */
  markdown?: boolean;

  /**
   * Content-Signal HTTP response headers to include on all responses.
   * Declares AI usage rights under EU Directive 2019/790.
   */
  signals?: ContentSignalsConfig;

  /**
   * Routes to never convert to markdown, even for agent requests.
   * Supports glob patterns. Useful for API endpoints that return JSON.
   * Default: ["/api/**", "*.json"]
   */
  excludeFromMarkdown?: string[];

  /**
   * Whether to include the x-markdown-tokens header in markdown responses.
   * Default: true
   */
  tokenHeader?: boolean;

  /**
   * Whether to serve markdown at <url>.md (e.g., /docs/intro.md → markdown version of /docs/intro).
   * Default: true
   */
  mdUrlSuffix?: boolean;

  /**
   * Custom CSS selectors for elements to strip before markdown conversion.
   * Added to the default list (nav, footer, aside, .ads, .cookie-banner, etc.).
   */
  stripSelectors?: string[];
}

// ---------------------------------------------------------------------------
// Layer 3: Analytics
// ---------------------------------------------------------------------------

export type AnalyticsStorageDriver = "sqlite" | "postgres" | "clickhouse" | "webhook" | "none";

export interface AnalyticsConfig {
  /**
   * Whether to enable the analytics layer.
   * Default: true
   */
  enabled?: boolean;

  /**
   * Storage backend for analytics events.
   * Default: "sqlite"
   */
  storage?: AnalyticsStorageDriver;

  /**
   * Connection string for postgres or clickhouse backends.
   * For sqlite: the path to the .db file (default: ".agentfriendly/analytics.db").
   * For webhook: the URL to POST analytics events to.
   */
  connectionString?: string;

  /**
   * Whether to track LLM referral events (human visitors arriving from AI citations).
   * Detects via Referer header from known AI platforms.
   * Default: true
   */
  trackLlmReferrals?: boolean;

  /**
   * For webhook storage: additional headers to include in webhook POSTs.
   * Useful for authentication (e.g., { "Authorization": "Bearer <secret>" }).
   */
  webhookHeaders?: Record<string, string>;

  /**
   * Analytics events are batched and written asynchronously.
   * This controls the maximum batch size before a flush is forced.
   * Default: 50
   */
  batchSize?: number;

  /**
   * Maximum milliseconds between batch flushes.
   * Default: 5000 (5 seconds)
   */
  flushIntervalMs?: number;
}

// ---------------------------------------------------------------------------
// Layer 4: Access Control
// ---------------------------------------------------------------------------

export type AgentTypePolicy =
  | "deny-all" // Block all requests from this agent type
  | "allow-public" // Allow access to non-restricted routes only
  | "allow-all"; // Allow access to all routes (subject to route-level restrictions)

export interface AccessConfig {
  /**
   * Route paths to deny all agent access.
   * Supports glob patterns. Agents receive 403.
   * Example: ["/admin/**", "/billing/**", "/internal/**"]
   */
  deny?: string[];

  /**
   * Route paths to explicitly allow agent access.
   * When combined with deny, allow rules take precedence.
   * Example: ["/docs/**", "/api/public/**"]
   */
  allow?: string[];

  /**
   * Per-agent-category access policies.
   * Override the default allow-all behavior for specific categories.
   */
  agentTypes?: {
    "training-crawler"?: AgentTypePolicy;
    "search-bot"?: AgentTypePolicy;
    "interactive-agent"?: AgentTypePolicy;
    "browser-agent"?: AgentTypePolicy;
    /** Policy for suspected-agent tier requests (no UA match). */
    "suspected-agent"?: AgentTypePolicy;
  };

  /**
   * Per-agent-operator access policies.
   * Key is the operator name as it appears in the UA database.
   * Example: { "ByteDance": "deny-all", "Anthropic": "allow-all" }
   */
  operators?: Record<string, AgentTypePolicy>;

  /**
   * Rate limiting for agent requests.
   * Human requests are not rate-limited by this config.
   */
  rateLimit?: {
    /** Maximum requests per window per agent identity (or IP for unverified agents). */
    maxRequests: number;
    /** Window size in seconds. Default: 60. */
    windowSeconds?: number;
    /**
     * What to use as the rate limit key.
     * "identity": verified agent ID (most precise) with IP fallback.
     * "ip": always use IP address.
     * "ua": use user-agent string as the key.
     * Default: "identity"
     */
    keyBy?: "identity" | "ip" | "ua";
  };
}

// ---------------------------------------------------------------------------
// Layer 5: Privacy / PII
// ---------------------------------------------------------------------------

export interface PrivacyConfig {
  /**
   * Whether to enable PII masking for agent responses.
   * Default: false (opt-in)
   */
  enabled?: boolean;

  /**
   * Additional regex patterns for PII detection, beyond the built-in patterns
   * (email addresses, phone numbers, SSNs, credit cards, IP addresses).
   * Example: [/employee-id-\d{6}/gi]
   */
  additionalPatterns?: RegExp[];

  /**
   * Whether to use Named Entity Recognition (NER) for detecting names and addresses.
   * NER is slower but catches things regex cannot. Requires the optional `compromise` dep.
   * Default: false
   */
  nerEnabled?: boolean;

  /**
   * Whether to use reversible tokenization (deterministic PII replacement)
   * instead of one-way masking. When true, the original values can be
   * recovered using the tokenization key for round-trip agentic workflows.
   * Default: false (one-way masking)
   */
  reversibleTokenization?: boolean;

  /**
   * Secret key for reversible tokenization. Required when `reversibleTokenization: true`.
   * Use an environment variable. Minimum 32 bytes of entropy.
   */
  tokenizationSecret?: string;

  /**
   * Routes where PII masking is applied.
   * Default: all agent responses.
   * Supports glob patterns.
   */
  applyToRoutes?: string[];

  /**
   * Routes where PII masking is explicitly NOT applied.
   * Supports glob patterns.
   * Example: ["/api/agent/converse"] — trust the converse endpoint to manage its own PII
   */
  excludeRoutes?: string[];
}

// ---------------------------------------------------------------------------
// Layer 6: Tools / Agent Interactivity
// ---------------------------------------------------------------------------

export interface ToolsConfig {
  /**
   * Whether to enable tool registration and discovery.
   * Default: true
   */
  enabled?: boolean;

  /**
   * Base path for AHP task endpoints.
   * Default: "/agent"
   * Results in: POST /agent/converse, POST /agent/task, GET /agent/task/:id
   */
  basePath?: string;

  /**
   * Maximum time in milliseconds a MODE3 task can run before timing out.
   * Default: 300000 (5 minutes)
   */
  taskTimeoutMs?: number;

  /**
   * Whether to retain completed task results in storage.
   * Useful for allowing agents to re-fetch results.
   * Default: true, retained for 24 hours.
   */
  retainResults?: boolean;

  /** How long to retain completed task results in seconds. Default: 86400 (24 hours). */
  resultRetentionSeconds?: number;
}

// ---------------------------------------------------------------------------
// Layer 7: Monetization
// ---------------------------------------------------------------------------

export type MonetizationNetwork = "base-mainnet" | "base-sepolia" | "solana-mainnet";

export interface X402RouteConfig {
  /** Price per request (e.g., "$0.001" or 0.001 for USDC). */
  price: string | number;
  /** The blockchain network for payment. */
  network: MonetizationNetwork;
  /** Optional human-readable description shown in the 402 response body. */
  description?: string;
  /** Wallet address to receive payments. If omitted, uses the global address. */
  to?: string;
}

export interface MonetizationConfig {
  /**
   * Whether to enable the monetization layer.
   * Default: false (opt-in)
   */
  enabled?: boolean;

  /**
   * Your USDC wallet address to receive x402 payments.
   * Required when enabled is true and using x402.
   */
  walletAddress?: string;

  /**
   * The blockchain network to use for x402 payments.
   * Default: "base-mainnet"
   */
  network?: MonetizationNetwork;

  /**
   * Route-level pricing rules.
   * Key is a glob pattern like "GET /api/premium/**".
   * Value is the pricing config for matching routes.
   * Example:
   * ```typescript
   * routes: {
   *   "GET /api/reports/**": { price: "$0.001", network: "base-mainnet" },
   *   "POST /agent/task": { price: "$0.01", network: "base-mainnet" },
   * }
   * ```
   */
  routes?: Record<string, X402RouteConfig>;

  /**
   * Fallback monetization provider for publishers not using x402.
   * When set to "tollbit", the SDK emits TollBit-compatible response headers
   * and optionally redirects bot traffic to the TollBit paywall subdomain.
   */
  fallback?: "tollbit" | false;

  /**
   * TollBit configuration. Required when fallback is "tollbit".
   */
  tollbit?: {
    /** Your TollBit paywall subdomain (e.g., "bot.yoursite.com"). */
    paywallSubdomain: string;
    /** Whether to redirect bot traffic to the paywall subdomain. Default: false. */
    redirectBotTraffic?: boolean;
  };

  /**
   * Agents in this list (matched against verifiedAgentId or agentName) are exempt
   * from payment requirements. Useful for internal agents or partner integrations.
   */
  exempt?: string[];
}

// ---------------------------------------------------------------------------
// Layer 8: Multi-Tenancy
// ---------------------------------------------------------------------------

export type OrmAdapter = "prisma" | "drizzle" | "none";

export interface MultiTenancyConfig {
  /**
   * Whether to enable multi-tenant agent session management.
   * Default: false (opt-in)
   */
  enabled?: boolean;

  /**
   * Secret key for signing RFC 8693 delegation tokens.
   * Use an environment variable. Minimum 32 bytes of entropy.
   */
  tokenSecret?: string;

  /**
   * Session TTL in seconds. Agents must re-authenticate after this.
   * Default: 3600 (1 hour)
   */
  sessionTtlSeconds?: number;

  /**
   * ORM adapter for tenant-scoped database queries.
   * When set, the SDK injects tenant context into Prisma/Drizzle clients.
   */
  ormAdapter?: OrmAdapter;

  /**
   * The URL of your site's agent authorization page.
   * This is the page where users grant agents permission to act on their behalf.
   * The SDK generates a React component for this page — this config points to where
   * you mount it.
   * Example: "/settings/agent-access"
   */
  authorizationPagePath?: string;
}

// ---------------------------------------------------------------------------
// Root Config
// ---------------------------------------------------------------------------

/**
 * The root configuration object for @agentfriendly.
 *
 * Pass this to the framework adapter (agentFriendly({ ... })) or export it
 * as default from agentfriendly.config.ts at the root of your project.
 *
 * @example
 * ```typescript
 * // agentfriendly.config.ts
 * import type { AgentFriendlyConfig } from "@agentfriendly/core"
 *
 * export default {
 *   detection: { proactiveMarkdown: "known" },
 *   content: { markdown: true, signals: { "ai-train": false, "ai-input": true } },
 *   analytics: { storage: "postgres", connectionString: process.env.DATABASE_URL },
 *   monetization: {
 *     enabled: true,
 *     walletAddress: process.env.WALLET_ADDRESS,
 *     routes: { "GET /api/premium/**": { price: "$0.001", network: "base-mainnet" } },
 *   },
 * } satisfies AgentFriendlyConfig
 * ```
 */
export interface AgentFriendlyConfig {
  detection?: DetectionConfig;
  discovery?: DiscoveryConfig;
  content?: ContentConfig;
  analytics?: AnalyticsConfig;
  access?: AccessConfig;
  privacy?: PrivacyConfig;
  tools?: ToolsConfig;
  monetization?: MonetizationConfig;
  multiTenancy?: MultiTenancyConfig;

  /**
   * Enable debug mode.
   * When true, the SDK adds detailed X-AgentFriendly-* response headers
   * and writes trace entries to the console. Never enable in production.
   * Default: false
   */
  debug?: boolean;

  /**
   * The trust tier at or above which agent-specific processing is applied.
   * Requests below this tier are treated as human.
   * Default: "known-agent"
   */
  minAgentTier?: TrustTier;
}

/**
 * Resolved configuration with defaults applied. All fields that have meaningful
 * defaults are filled in; fields that are truly optional (secrets, user-provided
 * values) remain optional.
 * @internal
 */
export interface ResolvedConfig {
  debug: boolean;
  minAgentTier: TrustTier;
  detection: Required<DetectionConfig>;
  discovery: Required<Omit<DiscoveryConfig, "converseEndpoint" | "llmsTxt">> & {
    llmsTxt: LlmsTxtConfig | false;
    converseEndpoint: DiscoveryConfig["converseEndpoint"];
  };
  content: Required<ContentConfig>;
  analytics: Required<Omit<AnalyticsConfig, "connectionString" | "webhookHeaders">> & {
    connectionString?: string;
    webhookHeaders?: Record<string, string>;
  };
  access: Required<Omit<AccessConfig, "rateLimit">> & {
    rateLimit?: AccessConfig["rateLimit"];
  };
  privacy: Required<Omit<PrivacyConfig, "tokenizationSecret">> & {
    tokenizationSecret?: string;
  };
  tools: Required<ToolsConfig>;
  monetization: Required<Omit<MonetizationConfig, "walletAddress" | "tollbit">> & {
    walletAddress?: string;
    tollbit?: MonetizationConfig["tollbit"];
  };
  multiTenancy: Required<Omit<MultiTenancyConfig, "tokenSecret">> & {
    tokenSecret?: string;
  };
}
