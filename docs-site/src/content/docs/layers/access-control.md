---
title: "Layer 4: Access Control"
description: Control which agents can access which routes, with rate limiting.
---

# Layer 4: Access Control

Layer 4 evaluates access policies for every agent request. Human requests are never subject to access control decisions.

## Route-Level Deny/Allow

Use glob patterns to control route access:

```typescript
createAgentFriendlyMiddleware({
  access: {
    // Block agents from these routes
    deny: ["/admin/**", "/private/**", "/api/internal/**"],

    // Allow list overrides deny rules
    allow: ["/admin/public", "/api/internal/status"],
  },
});
```

Deny/allow rules use [`fnmatch`](https://docs.python.org/3/library/fnmatch.html)-style glob patterns.

## Per-Agent-Type Policies

Apply blanket policies to specific agent categories:

```typescript
createAgentFriendlyMiddleware({
  access: {
    agentTypes: {
      // Block all training crawlers (GPTBot, ClaudeBot, CCBot, etc.)
      "training-crawler": "deny-all",

      // Search bots: allow public routes only
      "search-bot": "allow-public",

      // Interactive agents: full access
      "interactive-agent": "allow-all",
    },
  },
});
```

| Policy | Behavior |
|--------|----------|
| `deny-all` | 403 Forbidden for all routes |
| `allow-public` | Allow routes in the `allow` list, deny everything else |
| `allow-all` | No additional restrictions |

## Per-Operator Policies

Apply policies to specific operators (companies operating agents):

```typescript
createAgentFriendlyMiddleware({
  access: {
    operators: {
      "OpenAI": "deny-all",       // Block all OpenAI crawlers
      "Anthropic": "allow-all",   // Allow all Anthropic agents
      "Bytedance": "deny-all",    // Block Bytespider
    },
  },
});
```

## Rate Limiting

AgentFriendly includes an in-memory sliding window rate limiter:

```typescript
createAgentFriendlyMiddleware({
  access: {
    rateLimit: {
      maxRequests: 100,     // Maximum requests per window
      windowSeconds: 60,    // Window size in seconds
      keyBy: "identity",    // "identity" | "ip" | "ua"
    },
  },
});
```

Key strategies:
- `identity`: Rate limit by verified agent ID or UA string (recommended)
- `ip`: Rate limit by IP address
- `ua`: Rate limit by User-Agent string

:::caution
The built-in rate limiter is in-memory and resets on process restart. For production multi-instance deployments, use an external Redis-backed rate limiter.
:::

## Generating robots.txt

AgentFriendly can generate the AI agent section of your `robots.txt`:

```typescript
import { generateRobotsTxtAiSection } from "@agentfriendly/core";

const aiSection = generateRobotsTxtAiSection({
  agentTypes: {
    "training-crawler": "deny-all",
    "search-bot": "allow-all",
  },
  deny: ["/admin/**"],
});
```

This generates:
```
# training-crawler — policy: deny-all
User-agent: GPTBot
User-agent: ClaudeBot
User-agent: Google-Extended
Disallow: /

# search-bot — policy: allow-all
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
Allow: /
```

## 403 Response Format

When access is denied, agents receive a structured markdown response:

```
HTTP/1.1 403 Forbidden
Content-Type: text/markdown

# Access Denied

This route does not permit agent access. Policy: training-crawler — deny-all
```
