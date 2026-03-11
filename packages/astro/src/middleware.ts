import type { MiddlewareNext, APIContext } from "astro";

import {
  AgentFriendlyMiddleware,
  agentContextStorage,
  convertResponseToMarkdown,
} from "@agentfriendly/core";
import type { AgentFriendlyConfig, AgentRequest } from "@agentfriendly/core";

/**
 * @agentfriendly/astro — Astro Middleware
 *
 * Astro middleware is defined using the `defineMiddleware` pattern.
 * The adapter creates an Astro-compatible `onRequest` handler from the
 * AgentFriendly configuration.
 *
 * Usage (src/middleware.ts in your Astro project):
 * ```typescript
 * import { createAgentFriendlyMiddleware } from "@agentfriendly/astro"
 *
 * export const onRequest = createAgentFriendlyMiddleware({
 *   detection: { proactiveMarkdown: "known" },
 *   content: { markdown: true },
 * })
 * ```
 *
 * For Astro pages, read context via Astro.locals:
 * ```astro
 * ---
 * // src/pages/docs.astro
 * const { isAgent, tier } = Astro.locals.agentFriendly ?? {}
 * ---
 * ```
 *
 * Notes:
 * - Astro SSR mode: full middleware pipeline runs on every request.
 * - Astro static mode: only runs when using output:"server" or output:"hybrid".
 *   Static pages are pre-rendered at build time and not affected.
 * - HTML→Markdown conversion happens by intercepting the response after the
 *   Astro renderer finishes.
 */

/**
 * Convert an Astro APIContext to the framework-agnostic AgentRequest.
 */
function toAgentRequest(context: APIContext): AgentRequest {
  const headers: Record<string, string> = {};
  context.request.headers.forEach((value: string, key: string) => {
    headers[key.toLowerCase()] = value;
  });

  const url = new URL(context.request.url);
  const query: Record<string, string> = {};
  url.searchParams.forEach((value: string, key: string) => {
    query[key] = value;
  });

  const rawPath = url.pathname;
  const path =
    rawPath.length > 1 && rawPath.endsWith("/") ? rawPath.slice(0, -1) : rawPath;

  return {
    method: context.request.method,
    url: context.request.url,
    path,
    headers,
    body: null,
    query,
    ip:
      context.clientAddress ??
      context.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      null,
  };
}

/**
 * Create an Astro `onRequest` middleware handler from an AgentFriendly config.
 */
export function createAgentFriendlyMiddleware(config: AgentFriendlyConfig = {}) {
  const sdk = new AgentFriendlyMiddleware(config);

  return async function onRequest(
    context: APIContext,
    next: MiddlewareNext,
  ): Promise<Response> {
    const agentRequest = toAgentRequest(context);
    const result = await sdk.process(agentRequest);
    const { context: agentContext } = result;

    // Make context available in Astro.locals
    context.locals["agentFriendly"] = agentContext;

    // Thread context for getAgentContext() calls
    return agentContextStorage.run(agentContext, async () => {
      // Serve early responses directly
      if (result.earlyResponse?.handled) {
        const { earlyResponse } = result;
        const responseHeaders = new Headers(earlyResponse.headers);
        return new Response(earlyResponse.body, {
          status: earlyResponse.status,
          headers: responseHeaders,
        });
      }

      // Call the next middleware/page handler to get the response
      const response = await next();

      // Inject agent headers into the response
      const mutableHeaders = new Headers(response.headers);
      for (const [key, value] of Object.entries(
        result.contentInstructions.agentHeaders,
      )) {
        mutableHeaders.set(key, value);
      }

      // Convert HTML→markdown for agent requests
      if (result.contentInstructions.convertToMarkdown) {
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("text/html")) {
          const htmlBody = await response.text();
          const { markdown, estimatedTokens } = await convertResponseToMarkdown(
            htmlBody,
            agentRequest.url,
            result.contentInstructions.additionalStripSelectors,
          );

          mutableHeaders.set("Content-Type", "text/markdown; charset=utf-8");
          mutableHeaders.set("x-markdown-tokens", String(estimatedTokens));

          return new Response(markdown, {
            status: response.status,
            headers: mutableHeaders,
          });
        }
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: mutableHeaders,
      });
    });
  };
}
