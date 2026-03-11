# Layer 4: Access Control

The access control layer enforces who can access what routes, and at what rate. It runs before content negotiation and monetization so that unauthorized agents are rejected before any resources are consumed.

## Policy Evaluation Order

```
1. Route-level policies  (most specific, checked first)
2. Agent-type policies   (by agentType, e.g. "crawler")
3. Operator policies     (by agentOperator, e.g. "openai")
4. Rate limiter          (always checked after policy allows)
```

As soon as a `deny` rule matches, the pipeline stops and returns a `403 Forbidden`. If all policies pass, the rate limiter is checked.

---

## Route-Level Policies

The most common and most powerful policy mechanism. Routes are matched using glob patterns.

```typescript
access: {
  rules: [
    // Block all agents from /admin
    { path: "/admin/**", deny: "all" },

    // Only allow verified agents into the API
    { path: "/api/**", allow: "verified-agent" },

    // Allow known+verified agents to access the pricing page
    { path: "/pricing", allow: "known-agent" },

    // Allow only specific operators into beta endpoints
    { path: "/beta/**", allowOperators: ["openai", "anthropic"] },
  ],
}
```

### Rule Evaluation Logic

- `deny: "all"` → Deny all agent tiers. Humans are unaffected.
- `allow: "known-agent"` → Allow this tier and above (`known-agent`, `verified-agent`). Deny `suspected-agent`.
- `allowOperators: ["openai"]` → Allow only agents whose `agentOperator` matches. Requires `known-agent` tier minimum.
- No rule matches → Default is **allow** (opt-in restrictions, not opt-in access).

---

## Agent-Type Policies

Control access by the functional role of the agent:

```typescript
access: {
  agentTypePolicies: {
    crawler: "known-agent",       // crawlers need to be known
    assistant: "suspected-agent", // assistants can be suspected
    automation: "verified-agent", // automation requires verification
  },
}
```

Valid `agentType` values come from the UA database. Common values: `crawler`, `assistant`, `automation`, `scraper`, `monitoring`.

---

## Operator Policies

Blanket deny or require-verification for entire operators:

```typescript
access: {
  operatorPolicies: {
    deny: ["petalbot", "semrushbot"],        // block these operators entirely
    requireVerification: ["openai", "anthropic"], // must be cryptographically verified
  },
}
```

---

## Rate Limiting

The in-memory sliding window rate limiter tracks requests per agent identity. The identity key is:

```
{verifiedIdentity.agentId} if verified
{agentOperator}:{ip}       if known
{ip}                        if suspected
```

```typescript
access: {
  rateLimits: {
    "verified-agent": { requests: 1000, windowMs: 60_000 },
    "known-agent":    { requests: 100,  windowMs: 60_000 },
    "suspected-agent": { requests: 20,   windowMs: 60_000 },
  },
}
```

When the limit is exceeded, the layer returns `429 Too Many Requests` with:
```
Retry-After: 15
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1700000060
```

### Production Note

The in-memory rate limiter is suitable for single-process deployments (e.g., Cloudflare Workers with Durable Objects) but **will not work correctly** across multiple Node.js processes. For distributed deployments, replace the rate limiter backend with Redis using the `RateLimiterAdapter` interface.

---

## `robots.txt` Generation

The policy engine can generate an AI-specific robots.txt snippet for injection into your existing `/robots.txt` handler:

```typescript
import { generateAiRobotsTxt } from "@agentfriendly/core";

const aiSection = generateAiRobotsTxt(config.access);

// Example output:
// User-agent: GPTBot
// Disallow: /admin/
// Disallow: /private/
//
// User-agent: ClaudeBot
// Disallow: /admin/
```

This is a convenience utility — the SDK itself does not serve `/robots.txt`. You are responsible for merging the generated section with your existing file.

---

## Policy Response Bodies

Policy denials return a structured JSON body to help agents understand why access was denied:

```json
{
  "error": "access_denied",
  "reason": "This route requires verified-agent tier. Your current tier is known-agent.",
  "requiredTier": "verified-agent",
  "currentTier": "known-agent",
  "documentation": "https://example.com/.well-known/agent.json"
}
```

Rate limit responses:
```json
{
  "error": "rate_limit_exceeded",
  "limit": 100,
  "windowMs": 60000,
  "retryAfterMs": 15000
}
```
