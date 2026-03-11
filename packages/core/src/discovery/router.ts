import type { AgentContext } from "../types/agent-context.js";
import type { HandledResponse } from "../types/agent-response.js";

/**
 * Layer 1 — Discovery Router
 *
 * Intercepts requests for discovery file paths and serves the pre-generated
 * static content. These endpoints are available to all requestors (no trust
 * tier requirement — even human visitors can see what tools an agent can call).
 *
 * Handled paths:
 * - GET /llms.txt                          — AI sitemap
 * - GET /.well-known/agent.json            — AHP manifest
 * - GET /webagents.md                      — in-browser tool manifest
 * - GET /.well-known/agent-tools.json      — full JSON Schema tool definitions
 * - GET /.well-known/agent-tools/v{n}.json — versioned tool schema snapshots
 *
 * Paths are case-sensitive and normalized (no trailing slash).
 */

/** Pre-generated discovery file content. Built once at startup. */
export interface DiscoveryFiles {
  readonly llmsTxt: string;
  readonly agentJson: string;
  readonly webagentsMd: string;
  readonly agentToolsJson: string;
  /** Versioned snapshots of tool schemas: version → JSON string */
  readonly agentToolVersions: ReadonlyMap<string, string>;
}

const DISCOVERY_PATHS = new Set([
  "/llms.txt",
  "/.well-known/agent.json",
  "/webagents.md",
  "/.well-known/agent-tools.json",
  // Debug endpoint — only served when debug: true (gated in middleware.ts)
  "/agent-debug",
]);

/**
 * Check if a request path is a discovery endpoint.
 */
export function isDiscoveryPath(path: string): boolean {
  if (DISCOVERY_PATHS.has(path)) return true;
  // Check versioned tool paths: /.well-known/agent-tools/v{n}.json
  if (/^\/.well-known\/agent-tools\/v\d+\.json$/.test(path)) return true;
  return false;
}

/**
 * Serve a discovery file response.
 * Returns null if the path is not a discovery endpoint.
 * Returns a 404 HandledResponse if the path is discovery-shaped but the file doesn't exist.
 */
export function serveDiscoveryFile(
  path: string,
  files: DiscoveryFiles,
  context: AgentContext,
  debugMode = false,
): HandledResponse | null {
  if (!isDiscoveryPath(path)) return null;

  // Debug endpoint: /agent-debug — returns pipeline trace JSON
  if (path === "/agent-debug") {
    if (!debugMode) {
      return {
        handled: true,
        status: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Debug mode is not enabled. Set debug: true in AgentFriendlyConfig." }),
        contentType: "application/json",
      };
    }
    return {
      handled: true,
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
      body: JSON.stringify(
        {
          requestId: context.requestId,
          receivedAt: context.receivedAt,
          tier: context.tier,
          isAgent: context.isAgent,
          signals: context.signals,
          detectionReason: context.tierResolution.reason,
          userAgent: context.userAgent,
          matchedAgent: context.matchedAgent
            ? {
                agentName: context.matchedAgent.agentName,
                operator: context.matchedAgent.operator,
                category: context.matchedAgent.category,
                verificationSupport: context.matchedAgent.verificationSupport,
              }
            : null,
          verifiedIdentity: context.verifiedIdentity ?? null,
          tenantContext: context.tenantContext ?? null,
          trace: context.trace,
          sdkVersion: "0.1.0",
        },
        null,
        2,
      ),
      contentType: "application/json",
    };
  }

  switch (path) {
    case "/llms.txt":
      return {
        handled: true,
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
          "X-Robots-Tag": "noindex",
        },
        body: files.llmsTxt,
        contentType: "text/markdown",
      };

    case "/.well-known/agent.json":
      return {
        handled: true,
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        },
        body: files.agentJson,
        contentType: "application/json",
      };

    case "/webagents.md":
      return {
        handled: true,
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        },
        body: files.webagentsMd,
        contentType: "text/markdown",
      };

    case "/.well-known/agent-tools.json":
      return {
        handled: true,
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
        },
        body: files.agentToolsJson,
        contentType: "application/json",
      };

    default: {
      // Handle versioned tool paths: /.well-known/agent-tools/v{n}.json
      const versionMatch = /^\/.well-known\/agent-tools\/(v\d+)\.json$/.exec(path);
      if (versionMatch?.[1]) {
        const versionedContent = files.agentToolVersions.get(versionMatch[1]);
        if (versionedContent) {
          return {
            handled: true,
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Access-Control-Allow-Origin": "*",
              // Versioned tool schemas are immutable — long cache TTL
              "Cache-Control": "public, max-age=86400",
            },
            body: versionedContent,
            contentType: "application/json",
          };
        }
      }

      return {
        handled: true,
        status: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Discovery file not found", path }),
        contentType: "application/json",
      };
    }
  }
}
