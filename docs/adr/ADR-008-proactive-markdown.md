# ADR-008: Proactive Markdown with Configurable Trust Tier Threshold

**Status**: Accepted  
**Date**: March 2026

## Context

Only 3 of 7 major AI agents currently send `Accept: text/markdown` (Claude Code, Cursor, OpenCode). OpenAI Codex, Gemini CLI, GitHub Copilot, and Windsurf do not. If the SDK only serves markdown when the Accept header is present, it misses approximately half the agent market.

The alternative is to serve markdown proactively to requests that are identified as agent traffic via the trust tier system, even without the Accept header.

## Options Considered

**Option A: Only serve markdown when Accept header is present**  
Misses ~50% of agent traffic. No false positives for human browsers (browsers never request `text/markdown`).

**Option B: Always serve markdown to all `known-agent` and above**  
Maximizes coverage. Risk: a `known-agent` classification is based on UA matching, which has a small false positive rate (e.g., a developer testing with a bot UA in their browser).

**Option C: Configurable threshold with `"known"` as the default**  
Site owners choose their threshold. `"known"` default covers the vast majority of real agent traffic while keeping the false positive rate low. Power users can set `"suspected"` for maximum coverage or `false` for Accept-header-only.

## Decision

**Option C: Configurable threshold, `"known"` as default.**

## Rationale

- The `"known"` tier requires a positive match in the UA database — meaning the user-agent string is a recognized AI agent. Human browsers do not appear in this database. The false positive rate is negligible in practice.
- The `"suspected"` tier uses HTTP header heuristics (missing Accept-Language, no Cookie, etc.). This has a higher false positive rate for unusual browser setups (automated testing tools, curl, wget). Making it opt-in is appropriate.
- The `false` setting is useful for site owners who want strict compliance with the HTTP spec (only serve markdown when explicitly requested) or who have special requirements for always serving HTML.
- The `"verified"` setting is for security-conscious site owners who only want to serve optimized responses to cryptographically verified agents.

## Implementation

```typescript
// agentfriendly.config.ts
detection: {
  proactiveMarkdown: "known"   // default
  // proactiveMarkdown: "suspected"  // also serve suspected-agent tier
  // proactiveMarkdown: "verified"   // only serve verified-agent tier
  // proactiveMarkdown: false         // only serve when Accept: text/markdown sent
}
```

The content negotiator (Layer 2) reads the trust tier from the request context (set by Layer 0) and the `proactiveMarkdown` config value. It serves markdown when either (a) the Accept header requests it or (b) the trust tier meets the configured threshold.

## Consequences

- Site owners using `"known"` (the default) serve markdown to approximately 80%+ of real agent traffic based on UA database coverage.
- Site owners using `"suspected"` may serve markdown to some automated testing tools or CI checks that do not set full browser headers. This is generally acceptable — CI tools do not care about receiving markdown vs. HTML.
- The `debug` mode (Layer 6.2) adds `X-AgentFriendly-Markdown-Served: true` and `X-AgentFriendly-Detection-Method: ua-database` response headers so developers can see exactly why markdown was served.
