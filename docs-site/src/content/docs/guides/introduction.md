---
title: Introduction
description: What AgentFriendly is and why you need it.
---

# Introduction

**AgentFriendly** is an open-source SDK that makes your web application readable, navigable, and monetizable by AI agents — without requiring any changes to your existing HTML or routes.

## The Problem

When an AI agent (GPTBot, Claude, a browser-use agent, a Playwright-powered LLM) visits your website, it receives the same complex, noisy HTML that a human browser renders. This creates several problems:

- **Context inflation**: Navigation bars, ads, cookie banners, and sidebars can add thousands of unnecessary tokens to the agent's context window.
- **Invisible traffic**: You cannot distinguish agent visits from human visits, so you cannot make informed decisions about bot access.
- **No access control**: There is no standard way to restrict certain pages from agents (e.g., blocking training crawlers while allowing search bots).
- **No monetization**: Agents can consume your content for free, even at scale.
- **No tools**: Agents cannot interact with your application — they can only read it.

## The Solution

AgentFriendly is a middleware layer that intercepts every incoming request and:

1. **Detects** whether the requestor is a human or an agent (and which type).
2. **Serves markdown** instead of HTML for agent requests — reducing tokens by 60–90%.
3. **Publishes discovery files** (`/llms.txt`, `/.well-known/agent.json`) so agents know what your site offers.
4. **Controls access** — deny training crawlers, rate-limit specific operators, or charge per request.
5. **Masks PII** — strip sensitive fields from agent responses automatically.
6. **Exposes tools** — let agents call structured APIs via your website's own toolset.
7. **Charges agents** — use the x402 protocol to require micropayments for premium content.
8. **Scopes sessions** — issue delegation tokens so agents act _on behalf of_ specific users.

## Who Uses This?

- **SaaS companies** who want to expose their product to AI agents without building a separate MCP server.
- **Content publishers** who want to reduce token costs for AI crawlers while maintaining control.
- **Developers** who want analytics on AI agent traffic alongside human traffic.
- **Enterprise teams** who need to control which agents access which data, with a full audit trail.

## Key Concepts

### TrustTier

Every request resolves to one of four tiers:

| Tier              | Description                                                  |
| ----------------- | ------------------------------------------------------------ |
| `human`           | A real browser — no agent handling applied                   |
| `suspected-agent` | Heuristics suggest an agent, but no confirmation             |
| `known-agent`     | UA matched the agent database (GPTBot, Claude, etc.)         |
| `verified-agent`  | Cryptographically verified identity (RFC 9421 / Clawdentity) |

### 8 Processing Layers

AgentFriendly runs every agent request through an 8-layer pipeline:

```
Layer 0: Detection          → resolve TrustTier
Layer 1: Discovery          → serve llms.txt, agent.json, etc.
Layer 2: Content            → convert HTML → Markdown
Layer 3: Analytics          → track agent traffic events
Layer 4: Access Control     → deny/allow/rate-limit
Layer 5: Privacy            → mask PII fields
Layer 6: Tools              → expose callable tools to agents
Layer 7: Monetization       → x402 payment challenges
Layer 8: Multi-Tenancy      → RFC 8693 delegation tokens
```

## Next Steps

- [Quick Start](/guides/quick-start) — add AgentFriendly to your app in 5 minutes.
- [How It Works](/guides/how-it-works) — understand the full architecture.
- [Framework Guides](/frameworks/nextjs) — step-by-step setup for your framework.
