import type { Context, MiddlewareHandler } from "hono";

import {
  AgentFriendlyMiddleware,
  convertResponseToMarkdown,
} from "@agentfriendly/core";
import type { AgentFriendlyConfig, AgentRequest, AgentContext } from "@agentfriendly/core";

/**
 * @agentfriendly/hono — Hono Middleware Adapter
 *
 * Optimized for Cloudflare Workers and edge environments.
 * Uses the Hono context variable system for thread-local storage
 * (since AsyncLocalStorage is not available in Cloudflare Workers).
 *
 * Usage:
 * ```typescript
 * import { Hono } from "hono"
 * import { createAgentFriendlyMiddleware, getAgentContext } from "@agentfriendly/hono"
 *
 * const app = new Hono()
 *
 * app.use("*", createAgentFriendlyMiddleware({
 *   detection: { proactiveMarkdown: "known" },
 *   content: { markdown: true },
 * }))
 *
 * app.get("/docs", (c) => {
 *   const ctx = getAgentContext(c) // AgentContext from Hono context
 *   return c.html("<html>...</html>") // auto-converted for agents
 * })
 *
 * export default app
 * ```
 */

/** The Hono context variable key for AgentContext. */
const AGENT_CONTEXT_KEY = "agentFriendlyContext";

/**
 * Get the AgentContext for the current Hono request.
 * This is the Hono-specific alternative to `getAgentContext()` from core,
 * which uses AsyncLocalStorage (not available in Cloudflare Workers).
 */
export function getAgentContext(c: Context): AgentContext | null {
  return (c.get(AGENT_CONTEXT_KEY) as AgentContext | undefined) ?? null;
}

/**
 * Convert a Hono Context to the framework-agnostic AgentRequest.
 */
function toAgentRequest(c: Context): AgentRequest {
  const headers: Record<string, string> = {};
  c.req.raw.headers.forEach((value: string, key: string) => {
    headers[key.toLowerCase()] = value;
  });

  const url = c.req.url;
  const parsed = new URL(url);
  const query: Record<string, string> = {};
  parsed.searchParams.forEach((value: string, key: string) => {
    query[key] = value;
  });

  const rawPath = parsed.pathname;
  const path = rawPath.length > 1 && rawPath.endsWith("/")
    ? rawPath.slice(0, -1)
    : rawPath;

  return {
    method: c.req.method,
    url,
    path,
    headers,
    body: null, // Body reading must happen outside middleware for Hono
    query,
    ip: c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  };
}

/**
 * Create a Hono middleware from an AgentFriendly configuration.
 */
export function createAgentFriendlyMiddleware(
  config: AgentFriendlyConfig = {},
): MiddlewareHandler {
  const sdk = new AgentFriendlyMiddleware(config);

  return async function agentFriendlyMiddleware(c, next): Promise<Response | void> {
    const agentRequest = toAgentRequest(c);
    const result = await sdk.process(agentRequest);
    const { context } = result;

    // Store context in Hono's c.set() for access in route handlers
    c.set(AGENT_CONTEXT_KEY, context);

    if (result.earlyResponse) {
      const { earlyResponse } = result;
      if (earlyResponse.handled) {
        for (const [key, value] of Object.entries(earlyResponse.headers)) {
          c.header(key, value);
        }
        const bodyText = earlyResponse.body ? String(earlyResponse.body) : "";
        return new Response(bodyText || null, { status: earlyResponse.status });
      }
    }

    // Inject agent headers into the response
    for (const [key, value] of Object.entries(result.contentInstructions.agentHeaders)) {
      c.header(key, value);
    }

    await next();

    // Post-response: convert HTML to markdown if needed
    if (result.contentInstructions.convertToMarkdown) {
      const responseContentType = c.res.headers.get("content-type") ?? "";
      if (responseContentType.includes("text/html")) {
        const htmlBody = await c.res.text();
        const { markdown, estimatedTokens } = await convertResponseToMarkdown(
          htmlBody,
          agentRequest.url,
          result.contentInstructions.additionalStripSelectors,
        );

        c.res = new Response(markdown, {
          status: c.res.status,
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "x-markdown-tokens": String(estimatedTokens),
          },
        });

        // Re-apply agent headers to the new response
        for (const [key, value] of Object.entries(result.contentInstructions.agentHeaders)) {
          c.res.headers.set(key, value);
        }
      }
    }
  };
}
