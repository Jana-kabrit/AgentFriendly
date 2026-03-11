import type { H3Event } from "h3";
import {
  defineEventHandler,
  getRequestHeader,
  getRequestURL,
  setResponseHeader,
  send,
  setResponseStatus,
} from "h3";

import {
  AgentFriendlyMiddleware,
  agentContextStorage,
  convertResponseToMarkdown,
} from "@agentfriendly/core";
import type { AgentFriendlyConfig, AgentRequest } from "@agentfriendly/core";

/**
 * @agentfriendly/nuxt — Nuxt 3 Server Middleware
 *
 * Nuxt 3 uses h3 as its underlying HTTP framework. This adapter wraps the
 * AgentFriendly middleware for h3 event handlers.
 *
 * The module registration in `module.ts` adds this middleware automatically
 * when the module is added to the Nuxt config:
 *
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
 *
 * For server routes, context is available via the event context:
 * ```typescript
 * // server/api/products.get.ts
 * export default defineEventHandler((event) => {
 *   const ctx = event.context.agentFriendly
 *   return { isAgent: ctx?.isAgent ?? false }
 * })
 * ```
 */

/**
 * Convert an h3 event to the framework-agnostic AgentRequest.
 */
function toAgentRequest(event: H3Event): AgentRequest {
  const url = getRequestURL(event);
  const headers: Record<string, string> = {};

  // h3 provides a getRequestHeaders helper
  const rawHeaders = event.node.req.headers;
  for (const [key, value] of Object.entries(rawHeaders)) {
    if (typeof value === "string") {
      headers[key.toLowerCase()] = value;
    } else if (Array.isArray(value)) {
      headers[key.toLowerCase()] = value.join(", ");
    }
  }

  const query: Record<string, string> = {};
  url.searchParams.forEach((value: string, key: string) => {
    query[key] = value;
  });

  const rawPath = url.pathname;
  const path =
    rawPath.length > 1 && rawPath.endsWith("/") ? rawPath.slice(0, -1) : rawPath;

  return {
    method: event.node.req.method ?? "GET",
    url: url.toString(),
    path,
    headers,
    body: null,
    query,
    ip:
      (getRequestHeader(event, "x-forwarded-for") ?? "")
        .split(",")[0]
        ?.trim() ?? null,
  };
}

/**
 * Create an h3 event handler that runs the AgentFriendly pipeline.
 * Attach this as a server middleware in Nuxt via the module.
 */
export function createH3Middleware(config: AgentFriendlyConfig = {}) {
  const sdk = new AgentFriendlyMiddleware(config);

  return defineEventHandler(async (event: H3Event) => {
    const agentRequest = toAgentRequest(event);
    const result = await sdk.process(agentRequest);
    const { context } = result;

    // Make context available to Nitro server routes
    event.context["agentFriendly"] = context;

    // Thread context via AsyncLocalStorage for getAgentContext() calls
    agentContextStorage.run(context, () => {});

    // Serve early responses (discovery files, 403, 402, 429)
    if (result.earlyResponse?.handled) {
      const { earlyResponse } = result;
      setResponseStatus(event, earlyResponse.status);
      for (const [key, value] of Object.entries(earlyResponse.headers)) {
        setResponseHeader(event, key, value);
      }
      await send(event, earlyResponse.body ?? "");
      return;
    }

    // Inject agent response headers
    for (const [key, value] of Object.entries(
      result.contentInstructions.agentHeaders,
    )) {
      setResponseHeader(event, key, value);
    }

    // Signal to downstream handlers whether to convert HTML→markdown
    if (result.contentInstructions.convertToMarkdown) {
      event.context["agentFriendlyConvert"] = {
        enabled: true,
        requestUrl: agentRequest.url,
        stripSelectors: result.contentInstructions.additionalStripSelectors,
      };
    }

    // Do not return — allow the request to continue to the Nuxt router
  });
}

/**
 * Nuxt composable: wrap a server route handler to enable auto HTML→Markdown conversion.
 * Use this in server/api/*.get.ts files when returning HTML content to agents.
 */
export function defineAgentFriendlyHandler(
  handler: (event: H3Event) => Promise<string | Record<string, unknown>>,
) {
  return defineEventHandler(async (event: H3Event) => {
    const result = await handler(event);

    // Only convert HTML strings for agent requests
    const convertCtx = event.context["agentFriendlyConvert"] as
      | { enabled: boolean; requestUrl: string; stripSelectors: string[] }
      | undefined;

    if (
      convertCtx?.enabled &&
      typeof result === "string" &&
      result.trimStart().startsWith("<")
    ) {
      const { markdown, estimatedTokens } = await convertResponseToMarkdown(
        result,
        convertCtx.requestUrl,
        convertCtx.stripSelectors,
      );
      setResponseHeader(event, "Content-Type", "text/markdown; charset=utf-8");
      setResponseHeader(event, "x-markdown-tokens", String(estimatedTokens));
      return markdown;
    }

    return result;
  });
}
