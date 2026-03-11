---
title: "Layer 3: Analytics"
description: Track AI agent traffic alongside human traffic with structured events.
---

# Layer 3: Analytics

Layer 3 emits structured analytics events for every agent interaction, enabling you to understand who is accessing your site, what they're doing, and when.

## Event Types

| Event | When Emitted |
|-------|-------------|
| `page-view` | Agent views a page (markdown or HTML) |
| `tool-call` | Agent calls a registered tool |
| `access-denied` | Agent is denied by access policy |
| `payment-challenge` | Agent receives an x402 402 response |
| `payment-received` | Agent pays and accesses content |
| `llm-referral` | Visitor arrives from an LLM (ChatGPT, Perplexity, etc.) |

## Configuration

```typescript
createAgentFriendlyMiddleware({
  analytics: {
    enabled: true,
    storage: "webhook",  // "sqlite" | "postgres" | "clickhouse" | "webhook" | "none"
    trackLlmReferrals: true,

    // Webhook adapter
    connectionString: "https://your-analytics-server.com/events",
    webhookHeaders: {
      "Authorization": "Bearer your-token",
    },

    // Batching
    batchSize: 50,
    flushIntervalMs: 5000,
  },
});
```

## Custom Analytics Adapter

Implement the `AnalyticsAdapter` interface for custom storage:

```typescript
import type { AnalyticsAdapter, AnalyticsEvent } from "@agentfriendly/core";

class MyAdapter implements AnalyticsAdapter {
  async flush(events: AnalyticsEvent[]): Promise<void> {
    await myDb.analytics.insertMany(events);
  }

  async close(): Promise<void> {
    await myDb.close();
  }
}

const sdk = new AgentFriendlyMiddleware({
  analytics: { enabled: true },
});
sdk.setAnalyticsAdapter(new MyAdapter());
```

## LLM Referral Detection

AgentFriendly detects when a human visitor arrives from an LLM-powered source by inspecting the `Referer` header:

```
Referer: https://chatgpt.com/...     → llm: "ChatGPT"
Referer: https://perplexity.ai/...  → llm: "Perplexity"
Referer: https://claude.ai/...      → llm: "Claude"
```

This data helps you understand which AI products are driving traffic to your site.

## Example Event Shape

```json
{
  "type": "page-view",
  "timestamp": "2026-03-08T12:00:00.000Z",
  "requestId": "6ba7b810-...",
  "tier": "known-agent",
  "agentName": "GPTBot",
  "operator": "OpenAI",
  "category": "training-crawler",
  "path": "/blog/my-post",
  "method": "GET",
  "contentType": "text/markdown",
  "estimatedTokens": 1247
}
```
