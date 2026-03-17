import type { AgentFriendlyConfig, ResolvedConfig } from "./types/config.js";

/**
 * Resolve the user-provided configuration by merging with all defaults.
 * Returns a fully-typed ResolvedConfig where all optional fields are filled in.
 */
export function resolveConfig(config: AgentFriendlyConfig = {}): ResolvedConfig {
  return {
    debug: config.debug ?? false,
    minAgentTier: config.minAgentTier ?? "known-agent",

    detection: {
      proactiveMarkdown: config.detection?.proactiveMarkdown ?? "known",
      customAgents: config.detection?.customAgents ?? [],
      headerHeuristics: config.detection?.headerHeuristics ?? true,
      requestPatternAnalysis: config.detection?.requestPatternAnalysis ?? true,
      agentJsonAcceptHeader: config.detection?.agentJsonAcceptHeader ?? true,
    },

    discovery: {
      llmsTxt: config.discovery?.llmsTxt ?? {},
      agentJson: config.discovery?.agentJson ?? true,
      webagentsMd: config.discovery?.webagentsMd ?? true,
      agentTools: config.discovery?.agentTools ?? true,
      converseEndpoint: config.discovery?.converseEndpoint,
    },

    content: {
      markdown: config.content?.markdown ?? true,
      signals: {
        "ai-train": config.content?.signals?.["ai-train"] ?? false,
        "ai-input": config.content?.signals?.["ai-input"] ?? true,
        search: config.content?.signals?.["search"] ?? true,
      },
      excludeFromMarkdown: config.content?.excludeFromMarkdown ?? [],
      tokenHeader: config.content?.tokenHeader ?? true,
      mdUrlSuffix: config.content?.mdUrlSuffix ?? true,
      stripSelectors: config.content?.stripSelectors ?? [],
    },

    analytics: {
      enabled: config.analytics?.enabled ?? true,
      storage: config.analytics?.storage ?? "sqlite",
      ...(config.analytics?.connectionString !== undefined
        ? { connectionString: config.analytics.connectionString }
        : {}),
      trackLlmReferrals: config.analytics?.trackLlmReferrals ?? true,
      ...(config.analytics?.webhookHeaders !== undefined
        ? { webhookHeaders: config.analytics.webhookHeaders }
        : {}),
      batchSize: config.analytics?.batchSize ?? 50,
      flushIntervalMs: config.analytics?.flushIntervalMs ?? 5000,
    },

    access: {
      deny: config.access?.deny ?? [],
      allow: config.access?.allow ?? [],
      agentTypes: config.access?.agentTypes ?? {},
      operators: config.access?.operators ?? {},
      ...(config.access?.rateLimit !== undefined ? { rateLimit: config.access.rateLimit } : {}),
    },

    privacy: {
      enabled: config.privacy?.enabled ?? false,
      additionalPatterns: config.privacy?.additionalPatterns ?? [],
      nerEnabled: config.privacy?.nerEnabled ?? false,
      reversibleTokenization: config.privacy?.reversibleTokenization ?? false,
      ...(config.privacy?.tokenizationSecret !== undefined
        ? { tokenizationSecret: config.privacy.tokenizationSecret }
        : {}),
      applyToRoutes: config.privacy?.applyToRoutes ?? ["**"],
      excludeRoutes: config.privacy?.excludeRoutes ?? [],
    },

    tools: {
      enabled: config.tools?.enabled ?? true,
      basePath: config.tools?.basePath ?? "/agent",
      taskTimeoutMs: config.tools?.taskTimeoutMs ?? 300_000,
      retainResults: config.tools?.retainResults ?? true,
      resultRetentionSeconds: config.tools?.resultRetentionSeconds ?? 86_400,
    },

    monetization: {
      enabled: config.monetization?.enabled ?? false,
      ...(config.monetization?.walletAddress !== undefined
        ? { walletAddress: config.monetization.walletAddress }
        : {}),
      network: config.monetization?.network ?? "base-mainnet",
      routes: config.monetization?.routes ?? {},
      fallback: config.monetization?.fallback ?? false,
      ...(config.monetization?.tollbit !== undefined
        ? { tollbit: config.monetization.tollbit }
        : {}),
      exempt: config.monetization?.exempt ?? [],
    },

    multiTenancy: {
      enabled: config.multiTenancy?.enabled ?? false,
      ...(config.multiTenancy?.tokenSecret !== undefined
        ? { tokenSecret: config.multiTenancy.tokenSecret }
        : {}),
      sessionTtlSeconds: config.multiTenancy?.sessionTtlSeconds ?? 3600,
      ormAdapter: config.multiTenancy?.ormAdapter ?? "none",
      authorizationPagePath: config.multiTenancy?.authorizationPagePath ?? "/agent-access",
    },
  };
}
