# Layer 1: Discovery

The discovery layer serves static, pre-computed files that help AI agents understand your website's structure, capabilities, and access rules — without needing to scrape or infer them. These files are analogous to `robots.txt` and `sitemap.xml` but designed specifically for AI agents.

## Discovery Files

| Path | Purpose | Standard |
|------|---------|---------|
| `/llms.txt` | Natural-language description of the site for LLM context | [llms.txt proposal](https://llmstxt.org/) |
| `/.well-known/agent.json` | Machine-readable site capabilities (AHP discovery document) | Agent Handshake Protocol |
| `/webagents.md` | Markdown-formatted tool manifest for human-readable agent discovery | webagents.md spec |
| `/.well-known/agent-tools.json` | Full JSON Schema tool definitions for registered tools | Internal |
| `/agent-debug` | Pipeline trace dump (only when `debug: true`) | Internal |

All files are **generated once at startup** from the SDK config and registered tools, then served from memory. There is no disk I/O on subsequent requests.

---

## `/llms.txt`

```
# My SaaS Platform

> An e-commerce platform for digital goods.

This site sells digital products. Use the /api/products endpoint to search
and purchase products. Authentication is required for all purchase operations.

## Available Tools
- searchProducts(query, category, priceRange)
- getProduct(productId)
- checkout(cartId, paymentMethod)

## Access Notes
- /admin/* is restricted to verified agents only
- Rate limit: 100 requests/minute per agent
```

Generated from `DiscoveryConfig.siteName`, `sitePurpose`, `siteDescription`, and the tool registry.

---

## `/.well-known/agent.json`

```json
{
  "schemaVersion": "1.0",
  "site": {
    "name": "My SaaS Platform",
    "url": "https://example.com",
    "purpose": "E-commerce platform for digital goods",
    "contact": "agents@example.com"
  },
  "modes": {
    "MODE1": true,
    "MODE2": true,
    "MODE3": false
  },
  "capabilities": {
    "markdownContent": true,
    "toolRegistry": true,
    "authentication": "JWT",
    "rateLimit": { "requestsPerMinute": 100 }
  },
  "tools": "/.well-known/agent-tools.json"
}
```

The `modes` field maps to Agent Handshake Protocol interaction modes:
- **MODE1**: Read-only. Agent reads content as markdown.
- **MODE2**: Tool invocation. Agent can call registered tools via POST.
- **MODE3**: Async task queuing. Agent submits tasks and polls for results.

---

## `/.well-known/agent-tools.json`

```json
{
  "schemaVersion": "1.0",
  "tools": [
    {
      "name": "searchProducts",
      "version": "1.2.0",
      "description": "Search the product catalog",
      "schema": {
        "type": "object",
        "properties": {
          "query": { "type": "string", "description": "Search query" },
          "category": { "type": "string", "enum": ["ebooks", "software", "courses"] },
          "priceRange": {
            "type": "object",
            "properties": {
              "min": { "type": "number" },
              "max": { "type": "number" }
            }
          }
        },
        "required": ["query"]
      },
      "pricing": {
        "model": "per-call",
        "amount": 0.001,
        "currency": "USDC"
      }
    }
  ]
}
```

---

## `/agent-debug` (debug mode only)

Returns a JSON trace of the current request's pipeline execution. Available only when `debug: true` is set in config. Must never be exposed in production.

```json
{
  "requestId": "a1b2c3d4-...",
  "timestamp": "2024-03-07T12:00:00.000Z",
  "tier": "known-agent",
  "signals": ["ua-database", "accept-header"],
  "agentOperator": "openai",
  "agentType": "crawler",
  "tenantContext": null,
  "pipeline": {
    "detectionMs": 0.8,
    "discoveryMs": 0.1,
    "accessMs": 0.2,
    "contentMs": 0.3
  }
}
```

---

## Startup vs. Request-Time Generation

```
Startup:
  resolveConfig()
  → generateLlmsTxt(config)       → stored in memory
  → generateAgentJson(config)      → stored in memory
  → generateWebagentsMd(config)    → stored in memory
  → generateAgentToolsJson(config) → stored in memory

Request time:
  serveDiscoveryFile(path)
  → memory lookup → immediate response (no computation)
```

Registered tools affect the generated files. If tools are registered **after** startup (e.g., lazily), `regenerateDiscoveryFiles()` must be called to refresh the in-memory content.

---

## Router (`discovery/router.ts`)

`DISCOVERY_PATHS` is the list of all paths handled by this layer:

```typescript
const DISCOVERY_PATHS = new Set([
  "/llms.txt",
  "/.well-known/agent.json",
  "/webagents.md",
  "/.well-known/agent-tools.json",
  "/agent-debug",
]);
```

When the orchestrator receives a request whose `path` is in `DISCOVERY_PATHS`, this layer immediately returns a `HandledResponse` and the pipeline terminates.

The `Content-Type` header is set appropriately:
- `/llms.txt` → `text/plain`
- `/.well-known/agent.json` → `application/json`
- `/webagents.md` → `text/markdown`
- `/.well-known/agent-tools.json` → `application/json`
- `/agent-debug` → `application/json`

---

## Relationship to `robots.txt`

The Access Control layer (Layer 4) can generate an AI-specific `robots.txt` section, but this is served separately from the user's own `robots.txt`. See [Layer 4 docs](./04-access-control.md).

The discovery files are complementary:
- `robots.txt` says what crawlers **may not** access.
- `llms.txt` says what the site **is** and what's most useful.
- `agent.json` describes **capabilities and modes**.
- `agent-tools.json` describes **available operations**.
