# Resolved Design Questions

This document records every open question that arose during the research phase and the decision made for each, including the rationale. These decisions are also captured as Architecture Decision Records (ADRs) in `docs/adr/`.

---

## Q1: Proactive markdown for suspected agents

**Question**: Should the SDK serve markdown to `suspected-agent` tier requests by default (opt-out), or require explicit opt-in by the site owner?

**Decision**: Fully configurable via `detection.proactiveMarkdown` with `"known"` as the default.

```typescript
detection: {
  proactiveMarkdown: "known" | "suspected" | "verified" | false;
}
```

- `"known"` (default) — serve markdown to `known-agent` tier and above, even without `Accept: text/markdown`
- `"suspected"` — also serve markdown to `suspected-agent` tier (more aggressive, opt-in)
- `"verified"` — only serve markdown when identity is cryptographically verified
- `false` — only serve markdown when `Accept: text/markdown` is explicitly sent

**Rationale**: The `"known"` default gives immediate value to site owners (most real agent traffic is covered) while avoiding false positives for `suspected-agent` requests, which have lower confidence. Site owners who want maximum coverage opt into `"suspected"`; security-conscious owners who want to serve markdown only to verified agents use `"verified"`.

---

## Q2: x402 + non-stablecoin users

**Question**: x402 requires a USDC/stablecoin wallet. Many developers will not have one. Should Stripe or another traditional payment system be a first-class option?

**Decision**: TollBit compatibility mode is the first-class fallback for non-stablecoin publishers. Stripe is explicitly excluded.

**Rationale**:

- x402 uses USDC stablecoins (not volatile crypto) on Layer-2 networks. Transaction costs are sub-cent. By January 2026, x402 had 100M+ payment flows and $600M volume, confirming real-world viability.
- Stripe requires account creation, KYC, webhook setup, and introduces ~2–3% fees plus a minimum charge floor well above x402's per-request micropayments. Autonomous agents cannot complete Stripe's payment flows without human intervention.
- TollBit routes bot traffic to a paywall subdomain via CDN user-agent detection and handles all payment processing on behalf of the publisher. Zero crypto required. Publishers set rates and collect revenue through TollBit's dashboard.
- Adding Stripe would require implementing an entire OAuth-style payment initiation flow that agents cannot autonomously complete. The value would be near zero.

**Implementation**: `monetization.fallback: "tollbit"` in config. When set, the SDK emits TollBit-compatible response headers and optionally redirects bot UA traffic to the configured TollBit paywall subdomain.

---

## Q3: WebMCP timing

**Question**: Should the SDK implement the WebMCP browser API now (behind a flag) or wait for Chrome stable?

**Decision**: WebMCP is excluded from SDK scope entirely until Chrome stable ships. See ADR-002.

**Rationale**:

- WebMCP is available only in Chrome 146 Canary (as of March 2026). Stable release is expected mid-2026.
- The spec is a W3C Draft Community Group Report — not yet a final standard. It may still change before stable release.
- WebMCP is Chrome-browser-specific. It does not work with non-browser agents (CLI tools, Playwright, API agents) which make up the majority of agent traffic today.
- `webagents.md` + AHP MODE2/MODE3 cover all interactivity use cases with stable, infrastructure-agnostic, any-HTTP-client-compatible specifications.
- A separate `@agentfriendly/webmcp` plugin can be built after Chrome stable ships. Its interface will be additive, not breaking.

---

## Q4: Python SDK

**Question**: Should a Python SDK be published from day one?

**Decision**: Yes. The Python SDK is part of the monorepo from day one.

**Rationale**:

- Python is the dominant language for backend development in the AI/ML ecosystem. FastAPI, Django, and Flask are the three most popular Python web frameworks.
- The `webagents.md` SDK (browser-use, PyPI) and many AI agent frameworks (LangChain, CrewAI, AutoGen) are Python-first. Site owners building agent-heavy backends are often Python developers.
- The agent UA database is a language-agnostic JSON file. No data duplication is needed — both TypeScript and Python packages load the same `agents.json`.
- Maintaining two SDKs from day one ensures parity rather than the Python SDK becoming a permanently second-class citizen.

**Implementation**: `python/` directory in the monorepo root. Package published as `agentfriendly` on PyPI. CI includes Python lint (ruff), type check (mypy), and tests (pytest) for Python 3.11, 3.12, and 3.13.

---

## Q5: Versioning strategy for tool contracts

**Question**: Should breaking tool API changes require a new major version of the SDK package, or should tool versioning be independent?

**Decision**: Tool versions are fully independent of SDK package versions.

**Rationale**:

- Coupling tool API versions to SDK versions would force site owners to release a new SDK major version every time they make a breaking change to one tool — even if no other SDK behavior changes. This is incorrect granularity.
- Agents that have learned to call `searchProducts@1.0` should continue to be able to do so after the site owner adds `searchProducts@2.0` with a different schema.
- The SDK's own versioning (e.g., `@agentfriendly/core@2.0.0`) follows its own semver based on SDK breaking changes (changed config shape, removed exports, etc.).

**Implementation**:

- Tools in `agentMeta` have an optional `version` field (default: `"1.0.0"`).
- Breaking changes increment the tool's own semver major (e.g., `"2.0.0"`).
- Old schemas remain accessible at `/agent-tools/v1.json`; new at `/agent-tools/v2.json`.
- The SDK logs a warning if a tool schema changes without a version bump.
- `/.well-known/agent-tools.json` always points to the latest version of each tool.
