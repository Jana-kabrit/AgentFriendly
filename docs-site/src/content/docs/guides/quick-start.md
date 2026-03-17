---
title: Quick Start
description: Add AgentFriendly to your app in 5 minutes.
---

import { Tabs, TabItem } from "@astrojs/starlight/components";

# Quick Start

Get AgentFriendly up and running in 5 minutes.

## 1. Install

<Tabs>
<TabItem label="Next.js">
```bash
pnpm add @agentfriendly/next
```
</TabItem>
<TabItem label="Express">
```bash
pnpm add @agentfriendly/express
```
</TabItem>
<TabItem label="Hono">
```bash
pnpm add @agentfriendly/hono
```
</TabItem>
<TabItem label="Nuxt 3">
```bash
pnpm add @agentfriendly/nuxt
```
</TabItem>
<TabItem label="Astro">
```bash
pnpm add @agentfriendly/astro
```
</TabItem>
<TabItem label="Python">
```bash
pip install agentfriendly[fastapi]
# or: agentfriendly[django]  agentfriendly[flask]
```
</TabItem>
</Tabs>

## 2. Add Middleware

<Tabs>
<TabItem label="Next.js">
Create or update `middleware.ts` in your project root:

```typescript
// middleware.ts
import { createAgentFriendlyMiddleware } from "@agentfriendly/next";

export default createAgentFriendlyMiddleware({
  detection: { proactiveMarkdown: "known" },
  content: { markdown: true },
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

</TabItem>
<TabItem label="Express">
```typescript
import express from "express";
import { createAgentFriendlyMiddleware } from "@agentfriendly/express";

const app = express();

app.use(createAgentFriendlyMiddleware({
detection: { proactiveMarkdown: "known" },
content: { markdown: true },
}));

````
</TabItem>
<TabItem label="Hono">
```typescript
import { Hono } from "hono";
import { createAgentFriendlyMiddleware } from "@agentfriendly/hono";

const app = new Hono();

app.use("*", createAgentFriendlyMiddleware({
  detection: { proactiveMarkdown: "known" },
  content: { markdown: true },
}));
````

</TabItem>
<TabItem label="Nuxt 3">
```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["@agentfriendly/nuxt"],
  agentFriendly: {
    detection: { proactiveMarkdown: "known" },
    content: { markdown: true },
  },
});
```
</TabItem>
<TabItem label="FastAPI">
```python
from fastapi import FastAPI
from agentfriendly.adapters.fastapi import AgentFriendlyMiddleware
from agentfriendly import AgentFriendlyConfig, DetectionConfig

app = FastAPI()
app.add_middleware(
AgentFriendlyMiddleware,
config=AgentFriendlyConfig(
detection=DetectionConfig(proactive_markdown="known"),
),
)

````
</TabItem>
</Tabs>

## 3. Test It

```bash
# Check what GPTBot sees on your home page
agentfriendly preview --url http://localhost:3000

# Validate your agent-friendly implementation
agentfriendly validate --url http://localhost:3000

# Simulate detection for a specific User-Agent
agentfriendly test-detection --ua "GPTBot/1.0"
````

## 4. What Happens Next?

Once the middleware is active:

- **Discovery files** are available at `/llms.txt` and `/.well-known/agent.json`.
- **Agent requests** (GPTBot, Claude, etc.) receive clean markdown instead of HTML.
- **Human requests** are completely unaffected.
- **Analytics** start tracking agent vs. human traffic.

## What Gets Served

For a human browser visiting your home page:

```
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8

<!DOCTYPE html>...  (full HTML with nav, ads, etc.)
```

For GPTBot visiting the same page:

```
HTTP/1.1 200 OK
Content-Type: text/markdown; charset=utf-8
Content-Signal: ai-train=no, ai-input=yes, search=yes
X-Markdown-Tokens: 847

# My Product

Welcome to the best product for developers...
```

## Next Steps

- [Layer 0: Detection](/layers/detection) — understand how agents are identified.
- [Layer 4: Access Control](/layers/access-control) — block training crawlers.
- [Layer 7: Monetization](/layers/monetization) — charge agents per request.
