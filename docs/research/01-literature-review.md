# Literature Review: The Agent-Friendly Web (March 2026)

## Summary

This document captures the research conducted in March 2026 that informed the design of the `@agentfriendly` SDK. The space is forming in real time — the findings here represent a snapshot at inception.

---

## The Problem

The web was built for humans. When an AI agent visits a website today, it receives the same response a browser does: HTML, CSS, JavaScript bundles, navigation menus, footers, ads, cookie banners — everything. None of this has value for an agent. It all consumes tokens.

Independent measurements from three companies in February 2026 confirm the scale:

| Company | HTML size | Markdown size | Reduction |
|---------|-----------|---------------|-----------|
| Vercel  | 500 KB    | 2 KB          | 99.6%     |
| Cloudflare | (measured by token count) | (measured by token count) | 80% |
| Checkly | 615 KB / 180,573 tokens | 2.3 KB / 478 tokens | 99.7% |

At current API pricing (GPT-5.3: $1.75/M input, $14/M output), a 50-page agent browsing session costs ~$0.04 in clean markdown vs. ~$16 processing raw HTML. Unconstrained agent tasks that browse dozens of pages hit $5–8+ per session in HTML. This is a real, measurable cost that is growing as agent usage scales.

---

## What Exploded in January–March 2026

The following shipped within a 6-week window:

- **Cloudflare "Markdown for Agents"** (Feb 2026): CDN-level HTML→markdown conversion for 3.8M+ domains. Returns `x-markdown-tokens` header.
- **Vercel content negotiation** (Feb 3, 2026): Next.js middleware approach, 99.6% token reduction.
- **WebMCP** (Feb 10, 2026): W3C Community Group standard, Chrome 146 Canary. `navigator.modelContext.registerTool()`. Google + Microsoft.
- **Cloudflare Content Signals** (Feb 2026): `content-signal: ai-train=no` HTTP response headers with legal basis under EU Directive 2019/790.
- **Clawdentity IETF Draft** (Feb 2026): Per-agent Ed25519 identity, Agent Identity Tokens, revocation.
- **WIMSE HTTP Signatures** (March 5, 2026): Workload Identity Tokens for application-level agent auth.
- **Vouched Agent Checkpoint** (Feb 24, 2026): Enterprise agent authentication and permissioning. 0.5–16% of traffic is AI agents.
- **x402 protocol milestone** (Jan 2026): 100M+ payment flows, $600M volume. Backers include Cloudflare, Google, AWS, Anthropic, Circle.

The space is not mature. It is forming in real time.

---

## The Existing Landscape

### Standards and Specs

**`llms.txt`** — Markdown file at `/llms.txt` listing key pages for agents, like a sitemap for AI. Required structure: H1 header (project name) + blockquote (short summary), optional linked sections. Pages linked from llms.txt should have clean markdown versions at `<url>.md`. Low AI-platform adoption so far.

**`robots.txt` AI directives** — The existing mechanism for controlling AI crawler access. Known AI user-agents include GPTBot (OpenAI training), OAI-SearchBot (SearchGPT), ChatGPT-User (browsing), ClaudeBot (Anthropic training), Claude-Web/anthropic-ai (browsing), PerplexityBot, Google-Extended, Bingbot, Applebot, CCBot, Bytespider, Meta-ExternalAgent, and 20+ others. Key distinction: training crawlers (GPTBot, ClaudeBot) absorb content without attribution; citation bots (ChatGPT-User, PerplexityBot) quote your content and drive referral traffic.

**Agent Handshake Protocol (AHP)** — `/.well-known/agent.json` manifest. MODE1 (static, compatible with llms.txt), MODE2 (`POST /agent/converse` for Q&A), MODE3 (`POST /agent/task` for async delegation). Draft 0.1. Discovery via `<link>` tag, `Accept: application/agent+json` header, or direct GET.

**webagents.md** — browser-use's proposal. Markdown manifest of JavaScript functions. Meta tag discovery (`<meta name="webagents-md">`). SDK parses manifest, generates TypeScript declarations, agent writes code like `await global.searchProducts("red shoes")` that executes via Playwright. Python SDK on PyPI (v0.1.0, MIT license).

**WebMCP** — Chrome 146 Canary. Declarative API: HTML `toolname` attribute on forms. Imperative API: `navigator.modelContext.registerTool()`. JSON Schema v7 for tool definitions. `e.agentInvoked` to detect agent vs human form submission. 89% token efficiency vs screenshots. **Excluded from SDK scope** (ADR-002: Chrome-only, unstable spec).

### Content Serving

**HTTP Content Negotiation (`Accept: text/markdown`)** — The clearest near-term winner. Claude Code sends `Accept: text/markdown, text/html, */*`. Cursor sends with quality factors. Only 3 of 7 major agents tested send this header (Claude Code, Cursor, OpenCode). Gemini CLI, Windsurf, GitHub Copilot, and OpenAI Codex do not.

**Cloudflare Markdown for Agents** — CDN-level HTML→markdown using Cloudflare's edge network. Returns `x-markdown-tokens` header. Enabled per Cloudflare zone. Requires using Cloudflare as CDN.

**Cloudflare Content Signals** — `content-signal: ai-train=yes, search=yes, ai-input=yes` response headers. Three signals: `ai-train` (training/fine-tuning), `ai-input` (real-time RAG retrieval), `search` (traditional search indexing). CC0 license with EU legal framing. Deployed to 3.8M+ domains with default `search=yes, ai-train=no`.

### Agent Detection and Analytics

**Dark Visitors** — SaaS tracking 40%+ of web traffic as hidden bot/agent traffic. Detects via server-side HTTP logs (bots do not execute JavaScript). Node.js SDK, WordPress plugin, Cloudflare integration. Auto-generates robots.txt. Tracks LLM referrals (Referer headers from perplexity.ai, claude.ai, chat.openai.com).

**Vouched Agent Checkpoint** — Enterprise-grade agent authentication launched Feb 24, 2026. Identifies, authenticates, and sets permissions for AI agents. Includes audit trails, revocation, and legal authorization requirements.

**Cloudflare Bot Management** — WAF-layer detection with static Detection IDs (header ordering analysis) and behavioral signals. Curated Verified Bots Program. Unusual header ordering (different from expected browser patterns) is a primary detection signal.

### Agent Identity Verification

**Cloudflare Web Bot Auth / RFC 9421** — Ed25519 HTTP Message Signatures. Bot generates a keypair; hosts JWKS at `/.well-known/http-message-signatures-directory`; signs all requests with `Signature` and `Signature-Input` headers per RFC 9421. Cloudflare validates at edge. Integrated into Verified Bots Program in 2025. Already in production.

**Clawdentity** (IETF Internet-Draft, Feb 2026) — Per-agent Ed25519 identity. Registry-issued Agent Identity Tokens (AIT) as JWTs containing agent DID, operator, and permission scopes. Proof-of-possession request signing. Certificate revocation capabilities.

**WIMSE HTTP Signatures** (draft-ietf-wimse-http-signature-02, March 5 2026) — Workload Identity Tokens (WIT) for workload-to-workload auth. End-to-end protection even through TLS proxies. Alternative to mutual TLS.

**Agent Identity Protocol (AIP)** — Open-source two-layer model. Layer 1: agent identity via certificates. Layer 2: policy-based authorization at the tool-call layer. Addresses the "God Mode Problem" where agents receive full API key access without distinct identity from human users.

### Monetization

**x402 protocol** — HTTP 402 "Payment Required" activated by Coinbase (May 2025). Flow: client requests resource → server responds HTTP 402 with machine-readable payment terms (amount, currency, network, wallet address) → client constructs and signs stablecoin transaction → client retries with `X-Payment` header containing payment proof → server verifies cryptographically (self-contained, no network call) → response served. Uses USDC on Base or Solana. Zero protocol fees. 100M+ payment flows, $600M volume by January 2026. Backers: Coinbase, Cloudflare, Google, AWS, Circle, Anthropic. One middleware line to implement (`app.use(paymentMiddleware(...))`).

**TollBit** — SaaS per-page agent pricing. Bot traffic routed to paywall subdomain via CDN user-agent detection (bots do not execute JS so this works at server level). Two license types: Full Display and Summarization. Publishers set rates by bot/page/keyword/directory. No revenue share; only transaction fee charged to AI customers. Publishers update rates continuously without renegotiating contracts.

**Agentis** — Gateway-based API monetization. Under 5 minutes to set up. No-code gateway + React checkout component. Direct agent-to-developer payments.

**Paywalls.ai** — OpenAI-compatible proxy. Per-token, per-request, or per-tool billing. Real-time ledger analytics.

### External Conversion Services (not native)

**Firecrawl** — External SaaS converts any URL to markdown/JSON for agent developers. $16/month for 3K pages. Page-credit pricing. Not native to the site being visited.

**Jina Reader (`r.jina.ai`)** — External proxy: prepend `r.jina.ai/` to any URL. Uses ReaderLM-v2 (1.5B model). Token-metered pricing (~$0.02 per million tokens after free tier). Not native.

**AgentQL** — AI-powered web automation query language. Self-healing selectors that survive DOM changes. Python and JavaScript SDKs. REST API. Targets agent developers, not site owners.

**Unbrowse** — Reverse-engineers websites into APIs. Automatic endpoint capture; learns reusable "skills" shared in a marketplace. Early-stage.

---

## The Gap

Despite all of the above, no single package exists that a developer can install into their Next.js, Express, Nuxt, or Astro project to get:

1. Multi-signal agent detection (not just Accept header)
2. Auto-generated `llms.txt`, `agent.json`, `webagents.md`, and `agent-tools.json`
3. Content negotiation middleware + HTML→markdown conversion
4. Content Signals response headers
5. Tool registration (webagents.md + AHP MODE2/MODE3)
6. Self-hosted agent vs. human analytics
7. Route-level access control + auto-generated `robots.txt`
8. Cryptographic agent identity verification (RFC 9421)
9. Agent traffic monetization (x402 + TollBit fallback)
10. PII masking for agent responses
11. Multi-tenant agent session delegation (RFC 8693)

This is the gap `@agentfriendly` fills.
