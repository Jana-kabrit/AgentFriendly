import {
  AgentFriendlyMiddleware,
  agentContextStorage,
  convertResponseToMarkdown,
} from "@agentfriendly/core";

import type { AgentFriendlyConfig, AgentRequest } from "@agentfriendly/core";
import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * @agentfriendly/express — Express Middleware Adapter
 *
 * Creates an Express RequestHandler from an AgentFriendly configuration.
 *
 * Usage (app.ts or server.ts):
 * ```typescript
 * import express from "express"
 * import { createAgentFriendlyMiddleware } from "@agentfriendly/express"
 *
 * const app = express()
 *
 * app.use(createAgentFriendlyMiddleware({
 *   detection: { proactiveMarkdown: "known" },
 *   content: { markdown: true },
 *   analytics: { storage: "postgres", connectionString: process.env.DATABASE_URL },
 * }))
 *
 * app.get("/docs", (req, res) => {
 *   // AgentContext is available via res.locals.agentContext
 *   const ctx = res.locals.agentContext
 *   res.send("<html>...</html>") // auto-converted to markdown for agents
 * })
 * ```
 *
 * The middleware:
 * 1. Detects whether the request is from an agent
 * 2. Serves discovery files directly (llms.txt, agent.json, etc.)
 * 3. Enforces access policy and rate limits
 * 4. Checks monetization requirements
 * 5. Attaches AgentContext to res.locals and AsyncLocalStorage
 * 6. Patches res.send/res.json to convert HTML→markdown for agent requests
 */

/**
 * Convert an Express Request to the framework-agnostic AgentRequest.
 */
function toAgentRequest(req: Request): AgentRequest {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") {
      headers[key.toLowerCase()] = value;
    } else if (Array.isArray(value)) {
      headers[key.toLowerCase()] = value.join(", ");
    }
  }

  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === "string") {
      query[key] = value;
    }
  }

  // Normalize path: strip trailing slash (except root)
  const rawPath = req.path;
  const path = rawPath.length > 1 && rawPath.endsWith("/") ? rawPath.slice(0, -1) : rawPath;

  return {
    method: req.method,
    url: `${req.protocol}://${req.get("host") ?? "localhost"}${req.originalUrl}`,
    path,
    headers,
    body: typeof req.body === "string" ? req.body : req.body ? JSON.stringify(req.body) : null,
    query,
    ip: req.ip ?? null,
  };
}

/**
 * Create an Express middleware function from an AgentFriendly configuration.
 */
export function createAgentFriendlyMiddleware(config: AgentFriendlyConfig = {}): RequestHandler {
  const sdk = new AgentFriendlyMiddleware(config);

  return async function agentFriendlyMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const agentRequest = toAgentRequest(req);
    const result = await sdk.process(agentRequest);
    const { context } = result;

    // Store context in res.locals for route handlers
    res.locals["agentContext"] = context;

    // Run the rest of the middleware stack within the AsyncLocalStorage context
    // so getAgentContext() works anywhere in the call stack
    agentContextStorage.run(context, () => {
      if (result.earlyResponse) {
        const { earlyResponse } = result;
        if (earlyResponse.handled) {
          res.status(earlyResponse.status);
          for (const [key, value] of Object.entries(earlyResponse.headers)) {
            res.setHeader(key, value);
          }
          res.send(earlyResponse.body);
          return;
        }
      }

      // Inject agent headers into the response
      for (const [key, value] of Object.entries(result.contentInstructions.agentHeaders)) {
        res.setHeader(key, value);
      }

      // Patch res.send to intercept HTML responses and convert to markdown for agents
      if (result.contentInstructions.convertToMarkdown) {
        const originalSend = res.send.bind(res);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.send = function patchedSend(body?: any): Response {
          const contentType = (res.getHeader("Content-Type") as string) ?? "";
          if (typeof body === "string" && contentType.includes("text/html")) {
            // Convert asynchronously — Express doesn't support async send natively,
            // so we convert and immediately call the original send
            convertResponseToMarkdown(
              body,
              agentRequest.url,
              result.contentInstructions.additionalStripSelectors,
            )
              .then(({ markdown, estimatedTokens }) => {
                res.setHeader("Content-Type", "text/markdown; charset=utf-8");
                res.setHeader("x-markdown-tokens", String(estimatedTokens));
                originalSend(markdown);
              })
              .catch(() => {
                // Fallback to original HTML if conversion fails
                originalSend(body);
              });
            return res;
          }
          return originalSend(body);
        };
      }

      next();
    });
  };
}
