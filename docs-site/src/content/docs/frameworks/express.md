---
title: Express.js
description: Add AgentFriendly to an Express.js app.
---

# Express.js

`@agentfriendly/express` integrates as a standard Express middleware.

## Installation

```bash
pnpm add @agentfriendly/express
```

## Setup

```typescript
import express from "express";
import { createAgentFriendlyMiddleware } from "@agentfriendly/express";

const app = express();

// Add AgentFriendly before all other middleware
app.use(
  createAgentFriendlyMiddleware({
    detection: { proactiveMarkdown: "known" },
    content: {
      markdown: true,
      signals: { "ai-train": false, "ai-input": true, search: true },
    },
    access: {
      deny: ["/admin/**"],
    },
  }),
);

// Your existing routes
app.get("/", (req, res) => {
  res.send("<html><body><h1>Hello World</h1></body></html>");
});

app.listen(3000);
```

## Accessing Context in Routes

```typescript
import { getAgentContext } from "@agentfriendly/core";

app.get("/products", (req, res) => {
  const ctx = getAgentContext();

  if (ctx?.isAgent) {
    res.json({ products: db.products.all() });
  } else {
    res.render("products", { products: db.products.all() });
  }
});
```

## HTML → Markdown

When a known agent requests an HTML route, the middleware intercepts `res.send()` and converts the HTML to markdown before it reaches the network.

```typescript
app.get("/blog/:slug", async (req, res) => {
  const post = await db.posts.find(req.params.slug);
  // Agents receive clean markdown; humans receive HTML
  res.send(`<html><body><article>${post.html}</article></body></html>`);
});
```

## Full Example

See `examples/express/` in the repository.
