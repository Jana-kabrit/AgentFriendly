---
title: "Layer 0: Detection"
description: How AgentFriendly identifies AI agents using a 4-signal detection pipeline.
---

# Layer 0: Detection

The detection pipeline runs for every request and resolves a **TrustTier** — the central classification that governs all downstream layer decisions.

## Trust Tiers

| Tier | Badge | Description |
|------|-------|-------------|
| `human` | <span class="tier-badge tier-human">human</span> | No agent signals detected. Normal browser request. |
| `suspected-agent` | <span class="tier-badge tier-suspected">suspected-agent</span> | Heuristic signals suggest an agent, but no UA match or identity proof. |
| `known-agent` | <span class="tier-badge tier-known">known-agent</span> | UA string matches the agent database. |
| `verified-agent` | <span class="tier-badge tier-verified">verified-agent</span> | Cryptographic identity verified (RFC 9421 or Clawdentity). |

## Signal 1: Accept Header

Agents that explicitly request markdown or `application/agent+json` will immediately trigger an agent signal.

```http
# Triggers: accept-header signal
Accept: text/markdown, text/html;q=0.5

# Also triggers: accept-header signal
Accept: application/agent+json, */*;q=0.5
```

**Important**: `*/*` wildcard alone does *not* trigger `application/agent+json` detection. Only an explicit `application/agent+json` entry in the Accept header counts.

## Signal 2: UA Database

AgentFriendly ships with a comprehensive database of known AI agent User-Agent strings, covering:

- **Training crawlers**: GPTBot, ClaudeBot, Google-Extended, CCBot, …
- **Search bots**: OAI-SearchBot, ChatGPT-User, PerplexityBot, …
- **Interactive agents**: GoogleAgent-URLContext, Claude-Web, …
- **Browser agents**: Playwright with common agent overrides

The database supports three match types:
- `exact` — exact UA string match (highest confidence)
- `prefix` — string prefix match
- `regex` — regex pattern match (medium confidence)

Add custom agents in config:

```typescript
createAgentFriendlyMiddleware({
  detection: {
    customAgents: ["MyInternalBot/", "CompanyAgent-"],
  },
});
```

## Signal 3: Header Heuristics

Heuristic analysis scores the request based on missing browser signals. Each missing signal adds to a suspicion score; if the total exceeds the threshold (score ≥ 3), the request is flagged as `suspected-agent`.

| Heuristic | Weight | Reason |
|-----------|--------|--------|
| Missing `Accept-Language` | 2 | Real browsers always include this |
| No `Cookie` header | 1 | Sessions imply a real user |
| Minimal/wildcard Accept | 2 | Browsers send complex Accept headers |
| Non-browser UA structure | 1 | No `Mozilla/5.0 AppleWebKit` prefix |
| No `Sec-Fetch-*` headers | 2 | Browsers always send these |
| No `Referer` header | 1 | Navigation implies a referrer |
| Agent custom header | 3 | `x-agent-id`, `x-mcp-session`, etc. |

## Signal 4: Identity Verification

For cryptographically verified agents, two methods are supported:

### RFC 9421 HTTP Message Signatures

Agents that sign their requests with Ed25519 private keys (e.g., Cloudflare AI Gateway) can be verified against their operator's public keys fetched from `.well-known/jwks.json`:

```http
Signature: sig1=:base64encodedSignature:
Signature-Input: sig1=("@method" "@target-uri" "content-digest");created=1700000000;keyid="agent-key-1"
```

### Clawdentity Agent Identity Tokens

Agents using the Clawdentity standard include a signed JWT in the `Authorization` header:

```http
Authorization: AgentToken eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...
```

## Configuration

```typescript
createAgentFriendlyMiddleware({
  detection: {
    // When to proactively serve markdown (without explicit Accept header)
    proactiveMarkdown: "known", // "known" | "suspected" | "verified" | false

    // Custom UA patterns to detect as agents
    customAgents: ["MyBot/1.0", "InternalCrawler"],

    // Enable/disable header heuristics
    headerHeuristics: true,

    // Enable/disable request pattern analysis
    requestPatternAnalysis: true,

    // Enable application/agent+json Accept header detection
    agentJsonAcceptHeader: true,
  },
});
```

## Accessing Detection Results

In route handlers:

```typescript
import { getAgentContext } from "@agentfriendly/core";

export async function GET(request: Request) {
  const ctx = getAgentContext();
  if (!ctx) return new Response("Not in agent context");

  return Response.json({
    tier: ctx.tier,
    isAgent: ctx.isAgent,
    signals: ctx.signals,
    agentName: ctx.matchedAgent?.agentName,
    operator: ctx.matchedAgent?.operator,
    category: ctx.matchedAgent?.category,
  });
}
```
