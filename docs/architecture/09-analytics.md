# Layer 3: Analytics

The analytics layer gives you visibility into how AI agents are using your website — separate from human traffic. It tracks a discriminated union of events across the full request lifecycle.

## Event Types

```typescript
type AnalyticsEvent =
  | AgentPageViewEvent
  | AgentToolCallEvent
  | AgentAccessDeniedEvent
  | AgentPaymentChallengeEvent
  | AgentPaymentSuccessEvent
  | AgentMarkdownServedEvent
  | LlmReferralEvent;
```

### `AgentPageViewEvent`
Fired for every agent request that reaches content (not blocked by access/payment layers).

```typescript
{
  type: "agent-page-view",
  requestId: "...",
  tier: "known-agent",
  agentOperator: "openai",
  agentType: "crawler",
  path: "/docs/getting-started",
  method: "GET",
  timestamp: Date,
  markdownServed: true,
  tokenCount: 742,
}
```

### `AgentToolCallEvent`
Fired when a registered tool is invoked.

```typescript
{
  type: "agent-tool-call",
  toolName: "searchProducts",
  toolVersion: "1.2.0",
  tier: "verified-agent",
  agentOperator: "anthropic",
  durationMs: 45,
  success: true,
  timestamp: Date,
}
```

### `AgentAccessDeniedEvent`
Fired when a request is blocked by the access control layer.

```typescript
{
  type: "agent-access-denied",
  path: "/admin/users",
  reason: "route-deny",
  tier: "known-agent",
  timestamp: Date,
}
```

### `AgentPaymentChallengeEvent` / `AgentPaymentSuccessEvent`
Fired when the x402 layer issues or verifies a payment.

### `LlmReferralEvent`
Fired when an inbound request's `Referer` header matches a known LLM service domain (e.g., `chat.openai.com`, `claude.ai`, `perplexity.ai`).

```typescript
{
  type: "llm-referral",
  source: "chat.openai.com",
  path: "/pricing",
  timestamp: Date,
}
```

This event tracks **human users** arriving at your site after an LLM conversation (e.g., "ChatGPT mentioned your product") — a valuable signal for attributing LLM-driven organic traffic.

---

## Analytics Adapters

The collector forwards events to one or more adapters. Three are included:

### `NullAnalyticsAdapter`
Default. Discards all events. Zero overhead.

### `WebhookAnalyticsAdapter`
POSTs events to a webhook URL as NDJSON batches.

```typescript
analytics: {
  adapter: new WebhookAnalyticsAdapter({
    url: "https://your-analytics.example.com/events",
    batchSize: 50,
    flushIntervalMs: 5000,
    headers: { "Authorization": "Bearer secret" },
  }),
}
```

### Custom Adapter
Implement the `AnalyticsAdapter` interface:

```typescript
interface AnalyticsAdapter {
  track(event: AnalyticsEvent): void | Promise<void>;
  flush(): Promise<void>;
}

class PostHogAnalyticsAdapter implements AnalyticsAdapter {
  track(event) {
    posthog.capture(event.type, { ...event });
  }
  async flush() { /* PostHog batches internally */ }
}
```

---

## Performance Characteristics

The analytics layer is **off the critical path**. Events are:
1. Emitted synchronously into an in-memory buffer (< 0.1ms per event).
2. Flushed asynchronously in batches on a timer or when the buffer is full.

The route handler response is never blocked by analytics flushing.

---

## LLM Referral Detection

The `Referer` header is checked against a built-in list of LLM service domains:

```typescript
const LLM_REFERRAL_DOMAINS = [
  "chat.openai.com",
  "chatgpt.com",
  "claude.ai",
  "perplexity.ai",
  "you.com",
  "bard.google.com",
  "gemini.google.com",
  "copilot.microsoft.com",
  "bing.com",
];
```

This is distinct from agent detection — it tracks *human users* who were directed to your site by an LLM assistant.

---

## Configuration

```typescript
analytics: {
  enabled: true,
  adapter: new WebhookAnalyticsAdapter({ ... }),
  batchSize: 100,
  flushIntervalMs: 10_000,
  // Disable specific event types if you don't need them
  trackPageViews: true,
  trackToolCalls: true,
  trackPayments: true,
  trackLlmReferrals: true,
}
```
