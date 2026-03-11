---
title: Astro
description: Add AgentFriendly to an Astro SSR app.
---

# Astro

`@agentfriendly/astro` integrates as Astro middleware or an Astro integration.

## Installation

```bash
pnpm add @agentfriendly/astro
```

## Method 1: Middleware (Recommended)

Create `src/middleware.ts`:

```typescript
// src/middleware.ts
import { createAgentFriendlyMiddleware } from "@agentfriendly/astro";

export const onRequest = createAgentFriendlyMiddleware({
  detection: { proactiveMarkdown: "known" },
  content: {
    markdown: true,
    signals: { "ai-train": false, "ai-input": true, search: true },
  },
});
```

## Method 2: Integration

```javascript
// astro.config.mjs
import { defineConfig } from "astro/config";
import agentFriendly from "@agentfriendly/astro";

export default defineConfig({
  output: "server", // Required for SSR middleware
  integrations: [
    agentFriendly({
      detection: { proactiveMarkdown: "known" },
      content: { markdown: true },
    }),
  ],
});
```

## Accessing Context in Pages

```astro
---
// src/pages/blog/[slug].astro
const ctx = Astro.locals.agentFriendly;
const post = await fetchPost(Astro.params.slug);
---

<!-- Agents receive markdown via automatic conversion -->
<article>
  <h1>{post.title}</h1>
  <div set:html={post.html} />
</article>
```

## API Routes

```typescript
// src/pages/api/products.json.ts
import type { APIRoute } from "astro";
import { getAgentContext } from "@agentfriendly/astro";

export const GET: APIRoute = async ({ request }) => {
  const ctx = getAgentContext();

  const products = await db.products.findAll();
  return new Response(JSON.stringify({ products }), {
    headers: { "Content-Type": "application/json" },
  });
};
```

## Notes

- Only works with `output: "server"` or `output: "hybrid"`.
- Static pages (`output: "static"`) are pre-rendered at build time and not affected by middleware.
- For static sites, serve a pre-generated `llms.txt` manually.
