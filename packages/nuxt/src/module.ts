import { defineNuxtModule, addServerHandler, createResolver } from "@nuxt/kit";

import type { AgentFriendlyConfig } from "@agentfriendly/core";

/**
 * @agentfriendly/nuxt — Nuxt 3 Module
 *
 * Registers the AgentFriendly server middleware and exposes configuration
 * via the `agentFriendly` key in nuxt.config.ts.
 *
 * @example
 * ```typescript
 * // nuxt.config.ts
 * export default defineNuxtConfig({
 *   modules: ["@agentfriendly/nuxt"],
 *   agentFriendly: {
 *     detection: { proactiveMarkdown: "known" },
 *     content: { markdown: true, signals: { "ai-train": false } },
 *     access: { deny: ["/admin/**"] },
 *   },
 * })
 * ```
 */
export interface ModuleOptions extends AgentFriendlyConfig {}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: "@agentfriendly/nuxt",
    configKey: "agentFriendly",
    compatibility: {
      nuxt: "^3.0.0",
    },
  },

  defaults: {},

  setup(options, _nuxt) {
    const resolver = createResolver(import.meta.url);

    // Register the AgentFriendly middleware as the first global server middleware.
    // This ensures it runs before all Nitro route handlers.
    addServerHandler({
      middleware: true,
      handler: resolver.resolve("./runtime/middleware"),
    });

    // Pass the config to the runtime middleware via a virtual module
    // (Nuxt's addTemplate mechanism serializes the config into a file that
    // the runtime middleware imports at startup)
    _nuxt.options.runtimeConfig["agentFriendly"] = options;
  },
});
