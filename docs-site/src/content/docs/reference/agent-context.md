---
title: AgentContext
description: The central request context object threaded through every layer.
---

# AgentContext

`AgentContext` is the central object created by Layer 0 (Detection) and threaded through every subsequent layer via `AsyncLocalStorage` (TypeScript) or `ContextVar` (Python).

## Accessing AgentContext

```typescript
import { getAgentContext } from "@agentfriendly/core";

// In any async route handler:
const ctx = getAgentContext(); // AgentContext | null
```

```python
from agentfriendly import get_agent_context

ctx = get_agent_context()  # AgentContext | None
```

## Fields

### Core Detection

| Field                   | Type                | Description                          |
| ----------------------- | ------------------- | ------------------------------------ |
| `requestId`             | `string`            | UUID for this request                |
| `receivedAt`            | `string`            | ISO 8601 timestamp                   |
| `tier`                  | `TrustTier`         | Resolved trust tier                  |
| `signals`               | `DetectionSignal[]` | Signals that contributed to the tier |
| `isAgent`               | `boolean`           | `true` for any non-human tier        |
| `tierResolution.reason` | `string`            | Human-readable detection explanation |

### Agent Identity

| Field                              | Type                       | Description                                |
| ---------------------------------- | -------------------------- | ------------------------------------------ |
| `userAgent`                        | `string`                   | Raw User-Agent string                      |
| `matchedAgent`                     | `AgentEntry \| null`       | Matched database entry                     |
| `matchedAgent.agentName`           | `string`                   | e.g., `"GPTBot"`                           |
| `matchedAgent.operator`            | `string`                   | e.g., `"OpenAI"`                           |
| `matchedAgent.category`            | `AgentCategory`            | `"training-crawler"`, `"search-bot"`, etc. |
| `matchedAgent.verificationSupport` | `boolean`                  | Whether operator supports RFC 9421         |
| `verifiedIdentity`                 | `VerifiedIdentity \| null` | Cryptographic identity (if verified)       |

### Tenant Context

| Field                         | Type                    | Description                               |
| ----------------------------- | ----------------------- | ----------------------------------------- |
| `tenantContext`               | `TenantContext \| null` | Multi-tenancy context (if token provided) |
| `tenantContext.tenantId`      | `string`                | Tenant identifier                         |
| `tenantContext.userId`        | `string`                | Delegating user identifier                |
| `tenantContext.grantedScopes` | `string[]`              | Authorized scopes                         |
| `tenantContext.expiresAt`     | `string`                | Token expiry ISO 8601                     |

### Request Metadata

| Field               | Type                     | Description                        |
| ------------------- | ------------------------ | ---------------------------------- |
| `requestedMarkdown` | `boolean`                | Agent sent `Accept: text/markdown` |
| `path`              | `string`                 | Normalized URL path                |
| `method`            | `string`                 | HTTP method (uppercase)            |
| `headers`           | `Record<string, string>` | Lowercased request headers         |
| `query`             | `Record<string, string>` | URL query parameters               |
| `ip`                | `string \| null`         | Client IP address                  |
| `trace`             | `TraceEntry[]`           | Pipeline execution trace (debug)   |

## AgentCategory Values

| Value                 | Examples                                        |
| --------------------- | ----------------------------------------------- |
| `"training-crawler"`  | GPTBot, ClaudeBot, CCBot, Bytespider            |
| `"search-bot"`        | OAI-SearchBot, ChatGPT-User, PerplexityBot      |
| `"interactive-agent"` | GoogleAgent-URLContext, Claude-Web              |
| `"browser-agent"`     | Playwright-based agents with agent UA overrides |
