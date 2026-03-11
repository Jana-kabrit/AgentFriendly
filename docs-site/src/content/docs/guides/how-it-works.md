---
title: How It Works
description: The full 8-layer pipeline architecture.
---

# How It Works

AgentFriendly is a middleware SDK that processes every HTTP request through an 8-layer pipeline. Here is the complete architecture.

## Request Flow

```
Incoming Request
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 0: Detection Pipeline                                 │
│  ─────────────────────────────────────────────────────────── │
│  Signal 1: Accept Header   (text/markdown? application/agent+json?)   │
│  Signal 2: UA Database     (GPTBot, ClaudeBot, OAI-SearchBot, …)     │
│  Signal 3: Header Heuristics (missing sec-fetch-*, no cookies, …)    │
│  Signal 4: Identity Verify  (RFC 9421 Ed25519 / Clawdentity AIT)     │
│                                                              │
│  → Resolves TrustTier: human | suspected | known | verified  │
└──────────────────────────┬───────────────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │  human?                 │
              │  → passthrough, no      │
              │    agent handling       │
              └────────────────────────┘
                           │ agent
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 8 (pre-flight): Multi-Tenancy Token Validation        │
│  Validate X-Agent-Session JWT → inject TenantContext         │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 1: Discovery File Serving                             │
│  /llms.txt, /.well-known/agent.json, /webagents.md,          │
│  /.well-known/agent-tools.json, /agent-debug                 │
└──────────────────────────┬───────────────────────────────────┘
                           │ not a discovery path
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 4: Access Control                                     │
│  Per-operator rules, per-category rules, route deny/allow,   │
│  sliding window rate limiter                                 │
│  → 403 Forbidden / 429 Too Many Requests                     │
└──────────────────────────┬───────────────────────────────────┘
                           │ allowed
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 7: Monetization (x402)                                │
│  Match route pricing → if no valid X-Payment header:         │
│  → 402 Payment Required with USDC payment instructions       │
└──────────────────────────┬───────────────────────────────────┘
                           │ paid / not monetized
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 2: Content Negotiation Instructions                   │
│  Decide: convertToMarkdown? (based on tier + config)         │
│  Build Content-Signal header and debug headers               │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Route Handler         │
              │  (your app code)       │
              └────────────┬───────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Content Layer (post-response)                               │
│  If convertToMarkdown: convert HTML → clean Markdown         │
│  via jsdom + @mozilla/readability + turndown (TS)            │
│  or BeautifulSoup4 + markdownify (Python)                    │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
               Response sent to Agent
```

## Detection Signals

| Signal | How | Resolves to |
|--------|-----|-------------|
| `accept-header` | `Accept: text/markdown` or `Accept: application/agent+json` | ≥ suspected-agent |
| `ua-database` | Known UA pattern (GPTBot, ClaudeBot, etc.) | known-agent |
| `header-heuristics` | Missing `Accept-Language`, `Sec-Fetch-*`, `Cookie`, etc. | suspected-agent |
| `rfc9421-signature` | Ed25519 HTTP signature verified against operator JWKS | verified-agent |
| `clawdentity-ait` | Clawdentity Agent Identity Token (JWT) verified | verified-agent |

## Proactive Markdown Strategy

The `proactiveMarkdown` setting controls when markdown is served *without* an explicit `Accept: text/markdown` header:

| Setting | Serves markdown for |
|---------|---------------------|
| `"known"` | `known-agent` and `verified-agent` tiers |
| `"suspected"` | All agent tiers including `suspected-agent` |
| `"verified"` | Only `verified-agent` tier |
| `false` | Never — only when agent explicitly requests it |

## Content-Signal Header

Every agent response includes the `Content-Signal` header, which declares your site's AI content usage policy:

```
Content-Signal: ai-train=no, ai-input=yes, search=yes
```

This is inspired by the Cloudflare Content Signals standard and informs agents about:
- `ai-train`: whether content may be used for LLM training.
- `ai-input`: whether content may be used as LLM input (inference).
- `search`: whether content may be indexed by AI search engines.

## Debug Mode

Enable `debug: true` to add `X-AgentFriendly-*` headers to every response and activate the `/agent-debug` endpoint:

```typescript
createAgentFriendlyMiddleware({ debug: true })
```

Response headers in debug mode:
```
X-AgentFriendly-Tier: known-agent
X-AgentFriendly-Request-Id: 6ba7b810-9dad-11d1-80b4-00c04fd430c8
X-AgentFriendly-Signals: ua-database,accept-header
X-AgentFriendly-Detection-Reason: UA matched database (signals: ua-database)
X-AgentFriendly-Agent-Name: GPTBot
X-AgentFriendly-Agent-Operator: OpenAI
```
