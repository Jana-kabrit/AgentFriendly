---
title: "Layer 6: Tool Registry"
description: Expose callable tools to AI agents via the AHP tool manifest.
---

# Layer 6: Tool Registry

Layer 6 lets you expose structured, callable tools to AI agents — turning your website into an interactive service that agents can use, not just read.

## Why Tools?

Without tools, agents can only _read_ your site. With tools, they can:

- Search your product catalog
- Place orders
- Submit support tickets
- Query your analytics
- Trigger workflows

This is the equivalent of building an MCP server, but directly integrated into your existing web app — no separate deployment needed.

## Registering a Tool

```typescript
import { AgentFriendlyMiddleware } from "@agentfriendly/core";

const sdk = new AgentFriendlyMiddleware({
  tools: {
    enabled: true,
    basePath: "/agent", // Tools served at /agent/tools/:tool
    taskTimeoutSeconds: 300,
  },
});

sdk.registerTool(
  {
    tool: "search-products",
    version: "1.0.0",
    description: "Search the product catalog by query string and filters",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query" },
        category: { type: "string", description: "Product category filter" },
        limit: { type: "number", description: "Max results (1-50)", default: 10 },
      },
      required: ["query"],
    },
    requiredTier: "known-agent",
    rateLimit: { maxRequests: 20, windowSeconds: 60 },
  },
  async (input, context) => {
    const {
      query,
      category,
      limit = 10,
    } = input as {
      query: string;
      category?: string;
      limit?: number;
    };

    const results = await db.products.search({ query, category, limit });
    return { results, total: results.length };
  },
);
```

## Tool Definition Schema

| Field          | Type          | Required | Description                           |
| -------------- | ------------- | -------- | ------------------------------------- |
| `tool`         | `string`      | ✓        | Tool identifier (slug format)         |
| `version`      | `string`      |          | Semver version (default: `1.0.0`)     |
| `description`  | `string`      | ✓        | Human-readable description for agents |
| `inputSchema`  | `JSON Schema` | ✓        | JSON Schema v7 defining input shape   |
| `requiredTier` | `TrustTier`   |          | Minimum trust tier to call this tool  |
| `rateLimit`    | `object`      |          | Per-tool rate limit override          |
| `pricing`      | `object`      |          | x402 pricing for this specific tool   |

## Tool Manifest

Registered tools are automatically included in `/.well-known/agent-tools.json`:

```json
{
  "$schema": "https://agentfriendly.dev/schemas/agent-tools.json",
  "version": "1.0.0",
  "tools": {
    "search-products": {
      "description": "Search the product catalog",
      "inputSchema": { ... },
      "requiredTier": "known-agent",
      "endpoint": "/agent/tools/search-products"
    }
  }
}
```

## Tool Versioning

Register multiple versions of a tool:

```typescript
// v1: old API
sdk.registerTool({ tool: "search-products", version: "1.0.0", ... }, handlerV1);

// v2: new API with additional filter options
sdk.registerTool({ tool: "search-products", version: "2.0.0", ... }, handlerV2);
```

Agents can pin to a version:

```
GET /.well-known/agent-tools/v1.json  → v1 tool schemas
GET /.well-known/agent-tools/v2.json  → v2 tool schemas
```

## Async Tasks (AHP MODE3)

For long-running operations, register an async task handler:

```typescript
sdk.toolRegistry.registerTask({
  name: "generate-report",
  description: "Generate a custom analytics report (may take 30-60 seconds)",
  schema: {
    /* input schema */
  },
  handler: async (payload, context) => {
    const report = await analytics.generateReport(payload);
    return { reportUrl: report.url, generatedAt: new Date().toISOString() };
  },
});
```

Tasks use the AHP MODE3 polling pattern:

1. Agent submits task → receives `taskId`.
2. Agent polls `GET /agent/tasks/:taskId` for status.
3. When complete, agent retrieves the result.

## Accessing Agent Context in Tools

```typescript
sdk.registerTool(definition, async (input, context) => {
  // context is the full AgentContext
  const { tenantContext, tier, matchedAgent } = context;

  if (!tenantContext) {
    throw new Error("Tool requires an authenticated agent session");
  }

  // Scope operations to the current user
  const data = await db.query({ userId: tenantContext.userId });
  return data;
});
```
