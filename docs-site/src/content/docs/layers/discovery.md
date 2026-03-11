---
title: "Layer 1: Discovery"
description: Expose llms.txt, agent.json, webagents.md, and agent-tools.json for agent discovery.
---

# Layer 1: Discovery

Discovery files are the "front door" for AI agents — they describe what your site offers, what tools are available, and how agents should interact with it.

## Discovery Endpoints

AgentFriendly automatically serves the following endpoints for all requestors (including humans):

| Path | Content-Type | Purpose |
|------|-------------|---------|
| `/llms.txt` | `text/markdown` | AI sitemap — key pages, tools, and context |
| `/.well-known/agent.json` | `application/json` | AHP manifest — modes, endpoints, signals |
| `/webagents.md` | `text/markdown` | In-browser tool manifest (webagents.md spec) |
| `/.well-known/agent-tools.json` | `application/json` | Full JSON Schema tool definitions |
| `/agent-debug` | `application/json` | Pipeline trace (debug mode only) |

## /llms.txt

The `llms.txt` file (proposed standard by Jeremy Howard) provides a curated, agent-optimized view of your site's content:

```markdown
# My Product

> A developer productivity tool for AI-native teams.

## Key Pages

- [Documentation](https://example.com/docs): Full API reference
- [Pricing](https://example.com/pricing): Plans and pricing
- [Blog](https://example.com/blog): Latest updates

## API & Tools

- [Search Products](/api/search-products): Search the product catalog
```

Configure the content:

```typescript
createAgentFriendlyMiddleware({
  discovery: {
    llmsTxt: {
      title: "My Product",
      description: "A developer productivity tool for AI-native teams.",
      manualEntries: [
        { url: "/docs", description: "Full API reference" },
        { url: "/pricing", description: "Plans and pricing" },
      ],
      excludeRoutes: ["/admin/**"],
    },
  },
});
```

## /.well-known/agent.json

The AHP (Agent Handshake Protocol) manifest:

```json
{
  "ahp": "0.1",
  "modes": ["MODE1", "MODE2"],
  "name": "My Product",
  "description": "A developer productivity tool",
  "endpoints": {
    "content": "https://example.com/llms.txt",
    "tools": "https://example.com/.well-known/agent-tools.json"
  },
  "content_signals": {
    "ai_train": false,
    "ai_input": true,
    "search": true
  }
}
```

**AHP Modes**:
- `MODE1` — read-only content access
- `MODE2` — synchronous tool calls
- `MODE3` — asynchronous task execution

## Tool Versioning

When you register tools with different versions, AgentFriendly creates versioned snapshots at:

```
/.well-known/agent-tools/v1.json
/.well-known/agent-tools/v2.json
```

This allows agents to pin to a specific tool API version, preventing breakage when you update your tools.
