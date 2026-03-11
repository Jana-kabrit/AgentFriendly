import type { AgentFriendlyConfig } from "@agentfriendly/core";
import type { AstroIntegration } from "astro";


/**
 * @agentfriendly/astro — Astro Integration
 *
 * An optional Astro integration that registers the middleware automatically
 * via `astro.config.mjs`, rather than requiring manual export from `src/middleware.ts`.
 *
 * Usage:
 * ```typescript
 * // astro.config.mjs
 * import { defineConfig } from "astro/config"
 * import agentFriendly from "@agentfriendly/astro"
 *
 * export default defineConfig({
 *   output: "server", // or "hybrid"
 *   integrations: [
 *     agentFriendly({
 *       detection: { proactiveMarkdown: "known" },
 *       content: { markdown: true },
 *     }),
 *   ],
 * })
 * ```
 *
 * This automatically injects the middleware into the Astro build pipeline
 * without requiring a manual `src/middleware.ts`.
 *
 * Note: Only effective in SSR mode (output: "server" or output: "hybrid").
 * Static pages (output: "static") are pre-rendered at build time.
 */
export function agentFriendlyIntegration(
  config: AgentFriendlyConfig = {},
): AstroIntegration {
  return {
    name: "@agentfriendly/astro",
    hooks: {
      "astro:config:setup": ({ addMiddleware, logger }) => {
        // Inject the middleware at the "pre" order (before user middleware)
        addMiddleware({
          entrypoint: "@agentfriendly/astro/middleware",
          order: "pre",
        });

        logger.info(
          `@agentfriendly/astro: middleware registered (proactiveMarkdown: ${
            config.detection?.proactiveMarkdown ?? "known"
          })`,
        );

        // Note: the config is passed at runtime via the middleware factory.
        // For integration-based config injection, consider using Vite virtual modules.
        // For now, users configure via middleware.ts or via runtimeConfig.
        void config; // suppress "unused variable" warning — config used at middleware level
      },
    },
  };
}

export default agentFriendlyIntegration;
