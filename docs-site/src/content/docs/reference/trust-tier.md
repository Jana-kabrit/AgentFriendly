---
title: TrustTier
description: The four trust tiers and how they're resolved.
---

# TrustTier

The `TrustTier` type represents the classification assigned to every incoming request by Layer 0 (Detection).

## Type Definition

```typescript
type TrustTier =
  | "human"
  | "suspected-agent"
  | "known-agent"
  | "verified-agent";
```

## Tier Hierarchy

```
human < suspected-agent < known-agent < verified-agent
  0           1                2               3
```

Higher tiers indicate higher confidence that the requestor is an AI agent.

## Tier Descriptions

### `human`

No agent signals detected. The request has a complete set of browser-like headers and a User-Agent that does not match the agent database.

**Processing**: All agent-specific layers are skipped. The request is passed through unchanged.

### `suspected-agent`

Header heuristics triggered (score ≥ 3) or the request has unusual Accept headers, but no confirmed UA match.

**Processing**: Depends on `proactiveMarkdown` config:
- `proactiveMarkdown: "suspected"` → serve markdown
- Otherwise → passthrough, but agent context is available in route handlers

### `known-agent`

User-Agent matched a pattern in the agent database.

**Processing**: Markdown is served (with `proactiveMarkdown: "known"` or higher). All access control, rate limiting, and analytics layers apply.

### `verified-agent`

Cryptographic identity verified via RFC 9421 HTTP Message Signatures or Clawdentity Agent Identity Token.

**Processing**: Full trust. All agent features apply. Identity operator and agent ID are available in `context.verifiedIdentity`.

## Detection Signals

| Signal | Description | Contributes to |
|--------|-------------|----------------|
| `accept-header` | `Accept: text/markdown` or `application/agent+json` | ≥ suspected |
| `ua-database` | UA matched agent database | known |
| `header-heuristics` | Score ≥ 3 from header analysis | suspected |
| `rfc9421-signature` | Ed25519 HTTP signature verified | verified |
| `clawdentity-ait` | Clawdentity JWT verified | verified |

## Using TrustTier in Route Handlers

```typescript
import { getAgentContext, TIER_ORDER } from "@agentfriendly/core";

export async function GET() {
  const ctx = getAgentContext();
  if (!ctx) return new Response("No context");

  // Check exact tier
  if (ctx.tier === "verified-agent") {
    // Serve sensitive data only to verified agents
  }

  // Check minimum tier
  if (TIER_ORDER[ctx.tier] >= TIER_ORDER["known-agent"]) {
    // Serve to known and verified agents
  }
}
```
