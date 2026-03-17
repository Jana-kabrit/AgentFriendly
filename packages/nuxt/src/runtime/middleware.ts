/**
 * Nuxt runtime server middleware — loaded by Nitro at server startup.
 *
 * This file is referenced by module.ts via addServerHandler.
 * It reads the agentFriendly config from runtimeConfig and creates the middleware.
 *
 * Note: `useRuntimeConfig` comes from the `#imports` virtual module that Nuxt
 * auto-generates during build. We reference it as a global (provided by Nitro's
 * runtime environment) to avoid a compile-time module resolution error in the
 * SDK package itself, which is compiled outside of a Nuxt app context.
 */

import { createH3Middleware } from "../server-middleware.js";

import type { AgentFriendlyConfig } from "@agentfriendly/core";

// `useRuntimeConfig` is globally available in the Nitro runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const useRuntimeConfig: () => Record<string, any>;

const config: AgentFriendlyConfig =
  (useRuntimeConfig()["agentFriendly"] as AgentFriendlyConfig | undefined) ?? {};

export default createH3Middleware(config);
