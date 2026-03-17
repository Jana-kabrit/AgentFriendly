---
title: AgentFriendlyConfig
description: Complete reference for the AgentFriendlyConfig object.
---

# AgentFriendlyConfig

The root configuration object passed to all AgentFriendly middleware factory functions.

## TypeScript

```typescript
import type { AgentFriendlyConfig } from "@agentfriendly/core";

const config: AgentFriendlyConfig = {
  detection: {
    /* DetectionConfig */
  },
  discovery: {
    /* DiscoveryConfig */
  },
  content: {
    /* ContentConfig */
  },
  analytics: {
    /* AnalyticsConfig */
  },
  access: {
    /* AccessConfig */
  },
  privacy: {
    /* PrivacyConfig */
  },
  tools: {
    /* ToolsConfig */
  },
  monetization: {
    /* MonetizationConfig */
  },
  multiTenancy: {
    /* MultiTenancyConfig */
  },
  debug: false,
  minAgentTier: "known-agent",
};
```

## Python

```python
from agentfriendly import AgentFriendlyConfig

config = AgentFriendlyConfig(
    detection=DetectionConfig(...),
    content=ContentConfig(...),
    # all other fields optional — defaults are sensible
)
```

## Fields

### `detection` — DetectionConfig

| Field                    | Type                                            | Default   | Description                                           |
| ------------------------ | ----------------------------------------------- | --------- | ----------------------------------------------------- |
| `proactiveMarkdown`      | `"known" \| "suspected" \| "verified" \| false` | `"known"` | When to serve markdown without explicit Accept header |
| `customAgents`           | `string[]`                                      | `[]`      | Additional UA prefixes to treat as known agents       |
| `headerHeuristics`       | `boolean`                                       | `true`    | Enable heuristic detection                            |
| `requestPatternAnalysis` | `boolean`                                       | `true`    | Enable request pattern analysis                       |
| `agentJsonAcceptHeader`  | `boolean`                                       | `true`    | Enable `application/agent+json` detection             |

### `content` — ContentConfig

| Field                 | Type       | Default | Description                              |
| --------------------- | ---------- | ------- | ---------------------------------------- |
| `markdown`            | `boolean`  | `true`  | Enable HTML→Markdown conversion          |
| `signals["ai-train"]` | `boolean`  | `false` | Allow content for AI training            |
| `signals["ai-input"]` | `boolean`  | `true`  | Allow content for AI inference           |
| `signals.search`      | `boolean`  | `true`  | Allow AI search indexing                 |
| `excludeFromMarkdown` | `string[]` | `[]`    | Glob patterns to exclude from conversion |
| `stripSelectors`      | `string[]` | `[]`    | Additional CSS selectors to strip        |
| `tokenHeader`         | `boolean`  | `true`  | Include `x-markdown-tokens` header       |

### `access` — AccessConfig

| Field                     | Type                            | Default      | Description                            |
| ------------------------- | ------------------------------- | ------------ | -------------------------------------- |
| `deny`                    | `string[]`                      | `[]`         | Glob patterns that deny agent access   |
| `allow`                   | `string[]`                      | `[]`         | Glob patterns that override deny rules |
| `agentTypes`              | `Record<AgentCategory, Policy>` | `{}`         | Per-category policies                  |
| `operators`               | `Record<string, Policy>`        | `{}`         | Per-operator policies                  |
| `rateLimit.maxRequests`   | `number`                        | —            | Max requests per window                |
| `rateLimit.windowSeconds` | `number`                        | `60`         | Rate limit window size                 |
| `rateLimit.keyBy`         | `"identity" \| "ip" \| "ua"`    | `"identity"` | Rate limit key strategy                |

### `monetization` — MonetizationConfig

| Field           | Type                          | Default          | Description                       |
| --------------- | ----------------------------- | ---------------- | --------------------------------- |
| `enabled`       | `boolean`                     | `false`          | Enable x402 monetization          |
| `walletAddress` | `string`                      | —                | USDC receiving address            |
| `network`       | `string`                      | `"base-mainnet"` | Blockchain network                |
| `routes`        | `Record<string, RouteConfig>` | `{}`             | Per-route pricing                 |
| `exempt`        | `string[]`                    | `[]`             | Glob patterns exempt from payment |

### `multiTenancy` — MultiTenancyConfig

| Field                   | Type      | Default           | Description                       |
| ----------------------- | --------- | ----------------- | --------------------------------- |
| `enabled`               | `boolean` | `false`           | Enable multi-tenancy              |
| `tokenSecret`           | `string`  | —                 | JWT signing secret (min 32 chars) |
| `sessionTtlSeconds`     | `number`  | `3600`            | Token lifetime                    |
| `authorizationPagePath` | `string`  | `"/agent-access"` | Where users grant agent access    |

### `debug` — boolean

When `true`:

- Adds `X-AgentFriendly-*` headers to all responses.
- Enables the `/agent-debug` endpoint.

**Do not enable in production for public-facing traffic.**
