---
title: Hono / Cloudflare Workers
description: Add AgentFriendly to a Hono app running on Cloudflare Workers.
---

# Hono / Cloudflare Workers

`@agentfriendly/hono` integrates with [Hono](https://hono.dev) and is optimized for Cloudflare Workers.

## Installation

```bash
pnpm add @agentfriendly/hono
```

## Setup

```typescript
import { Hono } from "hono";
import { createAgentFriendlyMiddleware } from "@agentfriendly/hono";

const app = new Hono();

app.use(
  "*",
  createAgentFriendlyMiddleware({
    detection: { proactiveMarkdown: "known" },
    content: { markdown: true },
  }),
);

app.get("/", (c) => {
  return c.html("<html><body><h1>Hello World</h1></body></html>");
});

export default app;
```

## Accessing Context

The agent context is available on `c.get("agentFriendly")`:

```typescript
import { getAgentContext } from "@agentfriendly/core";

app.get("/products", (c) => {
  const ctx = c.get("agentFriendly"); // typed as AgentContext | undefined
  // or:
  const ctx2 = getAgentContext();

  if (ctx?.isAgent) {
    return c.json({ products: [] });
  }
  return c.html("<html>...</html>");
});
```

## Cloudflare Workers Context

Hono context variables need to be typed:

```typescript
// env.d.ts
import type { AgentContext } from "@agentfriendly/core";

type Variables = {
  agentFriendly: AgentContext | undefined;
};

const app = new Hono<{ Variables: Variables }>();
```

## Worker Entry Point

```typescript
// src/index.ts
import { Hono } from "hono";
import { createAgentFriendlyMiddleware } from "@agentfriendly/hono";

const app = new Hono();
app.use("*", createAgentFriendlyMiddleware({ detection: { proactiveMarkdown: "known" } }));

// routes...

export default app;
```

## Notes

- HTML→Markdown conversion works in Workers (uses the lightweight fallback).
- For full readability extraction, use `jsdom` with a Wasm build or convert on origin.
