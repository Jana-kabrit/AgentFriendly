---
title: Nuxt 3
description: Add AgentFriendly to a Nuxt 3 app via the official module.
---

# Nuxt 3

`@agentfriendly/nuxt` integrates as a Nuxt 3 module using server middleware.

## Installation

```bash
pnpm add @agentfriendly/nuxt
```

## Setup

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["@agentfriendly/nuxt"],
  agentFriendly: {
    detection: { proactiveMarkdown: "known" },
    content: {
      markdown: true,
      signals: { "ai-train": false, "ai-input": true, search: true },
    },
    access: {
      agentTypes: { "training-crawler": "deny-all" },
    },
  },
});
```

## Accessing Context in Server Routes

```typescript
// server/api/products.get.ts
export default defineEventHandler((event) => {
  const ctx = event.context.agentFriendly;

  if (ctx?.isAgent) {
    return { products: db.products.all() };
  }

  return { products: db.products.all(), meta: { total: 100 } };
});
```

Or use the `getAgentContext()` composable:

```typescript
import { getAgentContext } from "@agentfriendly/nuxt";

export default defineEventHandler((event) => {
  const ctx = getAgentContext(); // reads from AsyncLocalStorage
  return { isAgent: ctx?.isAgent ?? false };
});
```

## Agent-Friendly Server Routes

Wrap server routes that return HTML with `defineAgentFriendlyHandler` to enable auto markdown conversion:

```typescript
// server/api/blog/[slug].get.ts
import { defineAgentFriendlyHandler } from "@agentfriendly/nuxt";

export default defineAgentFriendlyHandler(async (event) => {
  const post = await db.posts.find(getRouterParam(event, "slug")!);
  return post.htmlContent; // Agents receive markdown; humans receive HTML
});
```
