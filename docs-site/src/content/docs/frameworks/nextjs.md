---
title: Next.js
description: Add AgentFriendly to a Next.js app using Edge Middleware.
---

# Next.js

`@agentfriendly/next` integrates with Next.js 14+ using the Edge Middleware API.

## Installation

```bash
pnpm add @agentfriendly/next
```

## Middleware Setup

Create or update `middleware.ts` in your project root (next to `package.json`):

```typescript
// middleware.ts
import { createAgentFriendlyMiddleware } from "@agentfriendly/next";

export default createAgentFriendlyMiddleware({
  detection: {
    proactiveMarkdown: "known",
  },
  content: {
    markdown: true,
    signals: { "ai-train": false, "ai-input": true, search: true },
  },
  access: {
    // Block training crawlers
    agentTypes: { "training-crawler": "deny-all" },
  },
});

export const config = {
  // Run on all routes except static assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

## API Routes with Agent Context

Use `withAgentFriendly` HOC to access agent context in route handlers:

```typescript
// app/api/products/route.ts
import { withAgentFriendly } from "@agentfriendly/next";
import { getAgentContext } from "@agentfriendly/core";

export const GET = withAgentFriendly(async (request: Request) => {
  const ctx = getAgentContext();

  if (ctx?.isAgent) {
    // Return agent-optimized JSON (less metadata, more content)
    return Response.json({ products: await db.products.findAll() });
  }

  // Full response for humans
  return Response.json({ products: await db.products.findAll(), meta: { total: 100 } });
});
```

## Accessing Context in Pages

```typescript
// app/blog/[slug]/page.tsx
import { getAgentContext } from "@agentfriendly/core";

export default function BlogPost({ params }: { params: { slug: string } }) {
  // Note: getAgentContext() is only available in route handlers,
  // not in React Server Components. Use request headers instead.
  const ctx = getAgentContext();

  return (
    <article>
      <h1>Blog Post</h1>
      {/* Your content */}
    </article>
  );
}
```

## Edge Runtime Compatibility

`@agentfriendly/next` is fully compatible with the Edge Runtime. The HTML→Markdown conversion uses a lightweight fallback when `jsdom` is not available (it's not supported in Edge Runtime).

For full conversion quality, ensure your route handlers are running in Node.js runtime:

```typescript
// app/api/content/route.ts
export const runtime = "nodejs"; // Full HTML→Markdown conversion
```

## Discovery Files

Discovery files (`/llms.txt`, `/.well-known/agent.json`, etc.) are served automatically by the middleware — no additional route handlers needed.

## Full Example

See the complete example at `examples/next/` in the repository.
