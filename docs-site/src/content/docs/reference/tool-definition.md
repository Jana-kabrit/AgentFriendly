---
title: ToolDefinition
description: Schema for registering tools with the AgentFriendly tool registry.
---

# ToolDefinition

The `ToolDefinition` interface describes a callable tool exposed to AI agents.

## TypeScript

```typescript
import type { ToolDefinition } from "@agentfriendly/core";

const searchTool: ToolDefinition = {
  tool: "search-products",
  version: "2.0.0",
  description: "Search the product catalog by query and filters",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query",
      },
      category: {
        type: "string",
        description: "Product category filter",
        enum: ["electronics", "clothing", "books"],
      },
      limit: {
        type: "number",
        description: "Maximum results to return (1-50)",
        minimum: 1,
        maximum: 50,
        default: 10,
      },
    },
    required: ["query"],
  },
  requiredTier: "known-agent",
  rateLimit: {
    maxRequests: 20,
    windowSeconds: 60,
  },
  pricing: {
    price: "0.0001",
    network: "base-mainnet",
  },
};
```

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tool` | `string` | ✓ | Tool identifier in slug format (e.g., `search-products`) |
| `version` | `string` | | Semver version (default: `"1.0.0"`) |
| `description` | `string` | ✓ | Description shown in tool manifest and to agents |
| `inputSchema` | `JSON Schema v7` | ✓ | Defines expected input parameters |
| `requiredTier` | `TrustTier` | | Minimum trust tier required (default: `"known-agent"`) |
| `rateLimit` | `object` | | Per-tool rate limit (overrides global limit) |
| `pricing` | `object` | | x402 pricing for this specific tool |
| `tags` | `string[]` | | Optional categorization tags |

## Registering a Tool

```typescript
const sdk = new AgentFriendlyMiddleware(config);

sdk.registerTool(searchTool, async (input, context) => {
  const { query, category, limit = 10 } = input as {
    query: string;
    category?: string;
    limit?: number;
  };

  const results = await db.products.search({ query, category, limit });
  return { results, total: results.length };
});
```

## Accessing Tools from an Agent

Once registered, tools are callable via:

```http
POST /agent/tools/search-products
Content-Type: application/json
User-Agent: GPTBot/1.0

{
  "query": "wireless headphones",
  "category": "electronics",
  "limit": 5
}
```

The tool manifest at `/.well-known/agent-tools.json` describes all available tools in JSON Schema format, allowing agents to discover and call them automatically.
