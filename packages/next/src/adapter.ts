import {
  AgentFriendlyMiddleware,
  agentContextStorage,
  convertResponseToMarkdown,
} from "@agentfriendly/core";
import { NextResponse } from "next/server";

import type { AgentFriendlyConfig, AgentRequest } from "@agentfriendly/core";
import type { NextRequest, NextMiddleware } from "next/server";


/**
 * @agentfriendly/next — Next.js Middleware Adapter
 *
 * Creates a Next.js middleware function from the AgentFriendly config.
 * Designed to run in the Edge Runtime (no Node.js-only APIs in the middleware itself).
 *
 * Usage (middleware.ts at the project root):
 * ```typescript
 * import { createAgentFriendlyMiddleware } from "@agentfriendly/next"
 *
 * export const middleware = createAgentFriendlyMiddleware({
 *   detection: { proactiveMarkdown: "known" },
 *   content: { markdown: true, signals: { "ai-train": false } },
 * })
 *
 * export const config = {
 *   matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
 * }
 * ```
 *
 * The middleware runs the full detection and access control pipeline on every
 * matching request. For human requests, it is a no-op (passthrough).
 * For agent requests, it may:
 * - Serve discovery files directly (llms.txt, agent.json, etc.)
 * - Deny access (403) based on policy rules
 * - Issue a payment challenge (402) for monetized routes
 * - Rate limit (429)
 * - Pass through with agent headers injected into the response
 *
 * HTML→Markdown conversion:
 * Next.js middleware runs on requests before routing, not on responses.
 * To convert HTML to markdown, the adapter intercepts the response from the
 * route handler by rewriting the request to a special /_agentfriendly/convert
 * route, or by using the middleware's response body modification capability.
 * In practice, markdown conversion is handled via a HOC on the route handler side.
 *
 * For the easiest integration, use `withAgentFriendly` on Route Handlers:
 * ```typescript
 * // app/docs/[slug]/route.ts
 * import { withAgentFriendly } from "@agentfriendly/next"
 *
 * export const GET = withAgentFriendly(async (request) => {
 *   const html = await renderPage(request)
 *   return new Response(html, { headers: { "Content-Type": "text/html" } })
 * })
 * ```
 */

/**
 * Convert a Next.js NextRequest to the framework-agnostic AgentRequest shape.
 */
function toAgentRequest(req: NextRequest): AgentRequest {
  const headers: Record<string, string> = {};
  for (const [key, value] of req.headers.entries()) {
    headers[key.toLowerCase()] = value;
  }

  const url = req.url;
  const parsed = new URL(url);
  const query: Record<string, string> = {};
  for (const [key, value] of parsed.searchParams.entries()) {
    query[key] = value;
  }

  // Normalize path: lowercase, strip trailing slash (except root)
  const rawPath = parsed.pathname;
  const path = rawPath.length > 1 && rawPath.endsWith("/")
    ? rawPath.slice(0, -1)
    : rawPath;

  return {
    method: req.method,
    url,
    path,
    headers,
    body: null, // Next.js middleware does not read request bodies
    query,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  };
}

/**
 * Convert a HandledResponse (from the orchestrator) to a NextResponse.
 */
function toNextResponse(
  status: number,
  body: string | Buffer | null,
  headers: Record<string, string>,
): NextResponse {
  const response = new NextResponse(body, { status });
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

/**
 * Create a Next.js middleware function from an AgentFriendly configuration.
 * The returned middleware is compatible with Next.js 14+ (App Router and Pages Router).
 */
export function createAgentFriendlyMiddleware(
  config: AgentFriendlyConfig = {},
): NextMiddleware {
  const sdk = new AgentFriendlyMiddleware(config);

  return async function agentFriendlyMiddleware(
    request: NextRequest,
  ): Promise<NextResponse | undefined> {
    const agentRequest = toAgentRequest(request);
    const result = await sdk.process(agentRequest);

    // Store context for downstream access via getAgentContext()
    // Note: AsyncLocalStorage works in Node.js runtime but not Edge Runtime.
    // For Edge Runtime, context is passed via request headers.
    agentContextStorage.run(result.context, () => {});

    // Pass context to route handlers via request headers (Edge Runtime compatible)
    const contextHeader = JSON.stringify({
      tier: result.context.tier,
      isAgent: result.context.isAgent,
      requestId: result.context.requestId,
      agentName: result.context.matchedAgent?.agentName ?? null,
    });

    if (result.earlyResponse) {
      const { earlyResponse } = result;
      if (earlyResponse.handled) {
        return toNextResponse(earlyResponse.status, earlyResponse.body, {
          ...earlyResponse.headers,
          "x-agentfriendly-context": contextHeader,
        });
      }
    }

    // Passthrough: let the request reach the route handler
    // Inject agent headers via NextResponse.next()
    const response = NextResponse.next();

    // Inject all agent response headers
    for (const [key, value] of Object.entries(result.contentInstructions.agentHeaders)) {
      response.headers.set(key, value);
    }

    // Signal to route handlers that markdown conversion is desired
    if (result.contentInstructions.convertToMarkdown) {
      response.headers.set("x-agentfriendly-convert-markdown", "1");
    }

    response.headers.set("x-agentfriendly-context", contextHeader);

    return response;
  };
}

/**
 * Higher-Order Component for Next.js Route Handlers (App Router).
 *
 * Wraps a GET/POST/etc handler and:
 * 1. Reads the AgentContext injected by the middleware
 * 2. Intercepts the HTML response and converts it to markdown if requested
 * 3. Injects Content-Signal and debug headers
 *
 * This is the recommended way to use @agentfriendly with the App Router
 * alongside the middleware setup.
 */
export function withAgentFriendly(
  handler: (request: NextRequest) => Promise<Response>,
): (request: NextRequest) => Promise<Response> {
  return async function wrappedHandler(request: NextRequest): Promise<Response> {
    const shouldConvert = request.headers.get("x-agentfriendly-convert-markdown") === "1";
    const agentHeaders = extractAgentHeaders(request.headers);

    const response = await handler(request);

    // If the response is not HTML or conversion was not requested, inject headers and return
    const contentType = response.headers.get("content-type") ?? "";
    if (!shouldConvert || !contentType.includes("text/html")) {
      const mutableResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
      for (const [key, value] of Object.entries(agentHeaders)) {
        mutableResponse.headers.set(key, value);
      }
      return mutableResponse;
    }

    // Convert HTML to markdown
    const htmlBody = await response.text();
    const conversionResult = await convertResponseToMarkdown(
      htmlBody,
      request.url,
      [], // additionalStripSelectors from SDK config would be passed here
    );

    const markdownResponse = new Response(conversionResult.markdown, {
      status: response.status,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "x-markdown-tokens": String(conversionResult.estimatedTokens),
        ...agentHeaders,
      },
    });

    return markdownResponse;
  };
}

/** Extract all X-AgentFriendly-* headers from a request, to re-inject into the response. */
function extractAgentHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of headers.entries()) {
    if (key.startsWith("x-agentfriendly-") || key === "content-signal") {
      result[key] = value;
    }
  }
  return result;
}
