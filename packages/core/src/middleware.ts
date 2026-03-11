import { AsyncLocalStorage } from "node:async_hooks";

import type { AgentContext } from "./types/agent-context.js";
import type { AgentRequest } from "./types/agent-request.js";
import type { AgentResponse } from "./types/agent-response.js";
import type { AgentFriendlyConfig, ResolvedConfig } from "./types/config.js";
import type { ToolDefinition } from "./types/tool-definition.js";

import { runDetectionPipeline } from "./detection/pipeline.js";
import {
  generateLlmsTxt,
  generateAgentJson,
  generateWebagentsMd,
  generateAgentToolsJson,
  isDiscoveryPath,
  serveDiscoveryFile,
} from "./discovery/index.js";
import type { DiscoveryFiles } from "./discovery/router.js";
import {
  shouldServeMarkdown,
  isExcludedFromMarkdown,
  buildContentSignalHeader,
  buildAgentResponseHeaders,
} from "./content/negotiator.js";
import { evaluatePolicy } from "./access/policy-engine.js";
import { InMemoryRateLimiter, getRateLimitKey } from "./access/rate-limiter.js";
import { checkMonetization } from "./monetization/x402.js";
import { validateDelegationToken } from "./multitenancy/token-issuer.js";
import { resolveConfig } from "./config.js";
import { ToolRegistry } from "./tools/registry.js";
import { InMemoryTaskQueue } from "./tools/task-queue.js";

/**
 * Core Middleware Orchestrator
 *
 * This is the heart of the SDK. It composes all 8 layers into a single
 * async function that processes each incoming request.
 *
 * Execution order:
 * 0. Detection pipeline → AgentContext
 * (if agent request:)
 *   1. Multi-tenancy: validate delegation token → inject TenantContext
 *   2. Discovery: serve static discovery files (llms.txt, agent.json, etc.)
 *   3. Access control: evaluate policy + rate limit
 *   4. Monetization: x402 payment check
 *   5. Content negotiation: decide whether to serve markdown
 * (always:)
 *   6. Inject agent response headers (Content-Signal, debug headers)
 *   7. Return AgentResponse (handled or passthrough)
 *
 * The HTML→markdown conversion itself happens in the framework adapter,
 * after the route handler has produced the HTML response. The orchestrator
 * signals this via the AgentResponse shape.
 */

/** AsyncLocalStorage for threading AgentContext through the request lifecycle. */
export const agentContextStorage = new AsyncLocalStorage<AgentContext>();

/**
 * Get the AgentContext for the current async execution context.
 * Returns null if called outside of a request handler.
 *
 * @example
 * ```typescript
 * import { getAgentContext } from "@agentfriendly/core"
 *
 * export async function GET(request: Request) {
 *   const ctx = getAgentContext()
 *   if (ctx?.isAgent) {
 *     // Customize response for agent
 *   }
 * }
 * ```
 */
export function getAgentContext(): AgentContext | null {
  return agentContextStorage.getStore() ?? null;
}

/** Indicates whether the content layer should convert the route response to markdown. */
export interface ContentInstructions {
  readonly convertToMarkdown: boolean;
  readonly requestUrl: string;
  readonly additionalStripSelectors: string[];
  readonly agentHeaders: Record<string, string>;
}

/** Full result returned by the orchestrator for a single request. */
export interface OrchestratorResult {
  /** The resolved agent context (always populated, even for human requests). */
  readonly context: AgentContext;
  /**
   * If non-null, the orchestrator is serving this response directly.
   * The framework adapter must return this response immediately, without
   * calling the route handler.
   */
  readonly earlyResponse: AgentResponse | null;
  /**
   * Instructions for the content layer, to be applied after the route handler runs.
   * Only meaningful when earlyResponse is null.
   */
  readonly contentInstructions: ContentInstructions;
}

export class AgentFriendlyMiddleware {
  readonly config: ResolvedConfig;
  readonly toolRegistry: ToolRegistry;
  readonly taskQueue: InMemoryTaskQueue;
  private readonly rateLimiter: InMemoryRateLimiter | null;
  private readonly discoveryFiles: DiscoveryFiles;

  constructor(userConfig: AgentFriendlyConfig = {}) {
    this.config = resolveConfig(userConfig);
    this.toolRegistry = new ToolRegistry();
    this.taskQueue = new InMemoryTaskQueue(this.config.tools.resultRetentionSeconds);

    // Initialize rate limiter if configured
    this.rateLimiter = this.config.access.rateLimit
      ? new InMemoryRateLimiter(
          this.config.access.rateLimit.maxRequests,
          this.config.access.rateLimit.windowSeconds ?? 60,
        )
      : null;

    // Pre-generate discovery files (these are regenerated when tools are registered)
    this.discoveryFiles = this.buildDiscoveryFiles([]);
  }

  /** Register a tool with its handler. Regenerates discovery files. */
  registerTool(definition: ToolDefinition, handler: Parameters<ToolRegistry["register"]>[1]): void {
    this.toolRegistry.register(definition, handler);
    // Discovery files are rebuilt on the next request (lazy evaluation)
  }

  /** Build all discovery files from current state. */
  private buildDiscoveryFiles(tools: readonly ToolDefinition[]): DiscoveryFiles {
    const siteDomain = "localhost"; // Framework adapters override this with the actual domain
    const llmsCfg = this.config.discovery.llmsTxt;
    const llmsTxtConfig = llmsCfg === false ? {} : (llmsCfg ?? {});

    return {
      llmsTxt: generateLlmsTxt({
        siteDomain,
        llmsTxtConfig,
        toolEntries: tools.map((t) => ({
          url: `/api/${t.tool}`,
          description: t.description,
          section: "API & Tools",
        })),
      }),
      agentJson: generateAgentJson({
        siteDomain,
        siteName: llmsTxtConfig.title ?? "Agent-Friendly Site",
        siteDescription: llmsTxtConfig.description ?? "An agent-friendly web application",
        tools,
        contentSignals: this.config.content.signals,
        hasConverseEndpoint: this.config.discovery.converseEndpoint !== undefined,
        hasTaskHandlers: this.toolRegistry.getAllTasks().length > 0,
        toolsBasePath: this.config.tools.basePath,
      }),
      webagentsMd: generateWebagentsMd(tools),
      agentToolsJson: generateAgentToolsJson(tools, siteDomain),
      agentToolVersions: new Map(),
    };
  }

  /**
   * Process an incoming request through all 8 layers.
   * Returns an OrchestratorResult the framework adapter uses to decide
   * how to respond.
   */
  async process(request: AgentRequest): Promise<OrchestratorResult> {
    // -----------------------------------------------------------------------
    // Layer 0: Detection Pipeline
    // -----------------------------------------------------------------------
    const context = await runDetectionPipeline(request, this.config.detection);

    // -----------------------------------------------------------------------
    // Layer 8 (pre-flight): Multi-Tenancy Token Validation
    // -----------------------------------------------------------------------
    let enrichedContext = context;
    if (this.config.multiTenancy.enabled) {
      // Accept delegation token in either Authorization or X-Agent-Session header
      const authHeader = request.headers["authorization"];
      const tokenHeader =
        request.headers["x-agent-session"] ??
        (authHeader?.match(/^(bearer|agentsession)/i) ? authHeader : undefined);

      if (tokenHeader) {
        const tokenResult = await validateDelegationToken(tokenHeader, this.config.multiTenancy);
        if (tokenResult.valid && tokenResult.tenantContext) {
          // Inject tenant context into a new (frozen) context object
          enrichedContext = Object.freeze({
            ...context,
            tenantContext: tokenResult.tenantContext,
          }) as AgentContext;
        }
      }
    }

    // -----------------------------------------------------------------------
    // Layer 1: Discovery File Serving (no tier restriction)
    // -----------------------------------------------------------------------
    if (isDiscoveryPath(request.path) && this.config.discovery.agentJson) {
      const tools = this.toolRegistry.getAllTools();
      const files = this.buildDiscoveryFiles(tools);
      const discoveryResponse = serveDiscoveryFile(request.path, files, enrichedContext, this.config.debug);
      if (discoveryResponse) {
        return {
          context: enrichedContext,
          earlyResponse: discoveryResponse,
          contentInstructions: noContentConversion(request.url),
        };
      }
    }

    // For non-agent requests, return immediately with passthrough + minimal headers
    if (!enrichedContext.isAgent) {
      return {
        context: enrichedContext,
        earlyResponse: null,
        contentInstructions: noContentConversion(request.url),
      };
    }

    // -----------------------------------------------------------------------
    // Layer 4: Access Control
    // -----------------------------------------------------------------------
    const policyResult = evaluatePolicy(enrichedContext, this.config.access as Parameters<typeof evaluatePolicy>[1]);

    if (policyResult.decision === "deny") {
      return {
        context: enrichedContext,
        earlyResponse: {
          handled: true,
          status: 403,
          headers: { "Content-Type": "text/markdown" },
          body: `# Access Denied\n\n${policyResult.reason}\n`,
          contentType: "text/markdown",
        },
        contentInstructions: noContentConversion(request.url),
      };
    }

    // Rate limiting
    const rateLimitConfig = this.config.access.rateLimit;
    if (this.rateLimiter && rateLimitConfig) {
      const key = getRateLimitKey(enrichedContext, rateLimitConfig.keyBy);
      const allowed = this.rateLimiter.check(key);
      if (!allowed) {
        const count = this.rateLimiter.getCount(key);
        return {
          context: enrichedContext,
          earlyResponse: {
            handled: true,
            status: 429,
            headers: {
              "Content-Type": "text/markdown",
              "Retry-After": "60",
            },
            body: `# Rate Limit Exceeded\n\nYou have exceeded the rate limit of ${rateLimitConfig.maxRequests} requests per ${rateLimitConfig.windowSeconds ?? 60} seconds. Current count: ${count}. Please slow down and retry.\n`,
            contentType: "text/markdown",
          },
          contentInstructions: noContentConversion(request.url),
        };
      }
    }

    // -----------------------------------------------------------------------
    // Layer 7: Monetization (x402)
    // -----------------------------------------------------------------------
    if (this.config.monetization.enabled) {
      const monetizationResponse = await checkMonetization(enrichedContext, this.config.monetization as Parameters<typeof checkMonetization>[1]);
      if (monetizationResponse) {
        return {
          context: enrichedContext,
          earlyResponse: monetizationResponse,
          contentInstructions: noContentConversion(request.url),
        };
      }
    }

    // -----------------------------------------------------------------------
    // Layer 2: Content Negotiation Instructions
    // -----------------------------------------------------------------------
    const agentHeaders = buildAgentResponseHeaders(
      enrichedContext,
      this.config.content,
      this.config.debug,
    );

    const willConvertMarkdown =
      shouldServeMarkdown(enrichedContext, this.config.content, this.config.detection.proactiveMarkdown) &&
      !isExcludedFromMarkdown(request.path, this.config.content.excludeFromMarkdown ?? []);

    if (this.config.content.tokenHeader && willConvertMarkdown) {
      agentHeaders["x-agentfriendly-will-convert"] = "markdown";
    }

    // Add Content-Signal header to all agent responses
    agentHeaders["content-signal"] = buildContentSignalHeader(this.config.content.signals);

    return {
      context: enrichedContext,
      earlyResponse: null,
      contentInstructions: {
        convertToMarkdown: willConvertMarkdown,
        requestUrl: request.url,
        additionalStripSelectors: this.config.content.stripSelectors ?? [],
        agentHeaders,
      },
    };
  }
}

/** Returns a no-op ContentInstructions for requests that don't need content conversion. */
function noContentConversion(url: string): ContentInstructions {
  return {
    convertToMarkdown: false,
    requestUrl: url,
    additionalStripSelectors: [],
    agentHeaders: {},
  };
}
