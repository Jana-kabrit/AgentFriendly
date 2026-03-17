# Dark Visitors — AI Agent Analytics and robots.txt Management

## What It Is

Dark Visitors is a SaaS platform that tracks AI agents, bots, and scrapers visiting your website. It claims that 40% of web traffic consists of hidden bot and agent activity that most site owners are unaware of.

- Website: [darkvisitors.com](https://darkvisitors.com)
- Node.js SDK: `npm install @darkvisitors/node-sdk`
- Also available for WordPress, Cloudflare, AWS, Fastly, Shopify, Python, PHP
- License: Apache-2.0

## What It Tracks

1. **AI crawlers and scrapers** — GPTBot, ClaudeBot, PerplexityBot, and 100+ others, detected in real-time
2. **Spoofed bots** — crawlers masquerading as legitimate browsers
3. **LLM referral traffic** — human users who came to your site from a link cited by an AI (tracked via `Referer` header from perplexity.ai, claude.ai, chat.openai.com, etc.)
4. **Traffic spike alerts** — unusually high bot traffic

## How Detection Works

This is the critical technical detail: **Dark Visitors detects bots using server-side HTTP logs, not JavaScript**.

Here is why this matters: Bots and scrapers typically do not execute JavaScript. If you use client-side analytics (Google Analytics, Mixpanel, a `<script>` tag), you are measuring human JavaScript-executing traffic only. Bot traffic is completely invisible in these tools.

Dark Visitors analyzes the raw HTTP request logs — every request that hits your server — and classifies each request by user-agent against its database.

## How to Use It

### Node.js SDK

```typescript
import DarkVisitors from "@darkvisitors/node-sdk";

const darkVisitors = new DarkVisitors({
  accessToken: process.env.DARK_VISITORS_ACCESS_TOKEN,
});

// Express middleware
app.use(async (req, res, next) => {
  await darkVisitors.track({
    requestPath: req.path,
    requestMethod: req.method,
    requestHeaders: req.headers,
  });
  next();
});
```

### Analytics Dashboard

The dashboard shows:

- Which agents are visiting, how often, and which pages
- Verification status (verified bots vs. suspected scrapers)
- LLM referral conversion rates (how many humans from AI-cited links become customers)
- Traffic trends over time

### Auto-generated robots.txt

Dark Visitors offers a "Dynamic robots.txt" feature: instead of maintaining a static `robots.txt` file, you point a DNS TXT record or a redirect to Dark Visitors' endpoint, which serves an up-to-date `robots.txt` that blocks/allows the latest known AI crawlers based on your settings.

## Pricing

Dark Visitors operates as a SaaS with a free tier and paid plans based on monthly requests.

## LLM Referral Tracking

This is a unique capability: Dark Visitors tracks traffic that comes to your site from AI citations. For example, when a user asks Perplexity "What is the best monitoring tool?", Perplexity cites your site. The user clicks the link. Their browser sends `Referer: https://www.perplexity.ai/search/...`. Dark Visitors captures this as an LLM referral event.

This is valuable because it shows the real impact of agent-friendly content: not just "agents read your docs" but "agents cite your docs, sending you human customers."

## How `@agentfriendly` Differs

Dark Visitors is a SaaS — all your data goes to their servers. `@agentfriendly` analytics (Layer 3) are **self-hosted**. Your agent traffic data stays in your own SQLite database, Postgres, or ClickHouse.

Additionally, Dark Visitors only provides analytics and `robots.txt` management. `@agentfriendly` provides:

- The same analytics (self-hosted)
- The same LLM referral tracking
- The same `robots.txt` auto-generation
- Plus: content serving (Layer 2), access control (Layer 4), identity verification (Layer 5), tool registration (Layer 6), monetization (Layer 7), and multi-tenancy (Layer 8)

The Dark Visitors Node.js SDK approach (middleware that logs every request to their API) can also introduce latency on every HTTP request. `@agentfriendly` analytics writes are batched and asynchronous — they never block the request.
