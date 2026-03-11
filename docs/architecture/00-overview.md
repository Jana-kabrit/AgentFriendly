# Architecture Overview

> **@agentfriendly/core** is a request-processing middleware SDK organized into 8 sequential, composable layers. This document provides the authoritative architectural reference for both the TypeScript and Python implementations.

## Table of Contents

1. [Design Principles](#design-principles)
2. [High-Level Diagram](#high-level-diagram)
3. [Layer Map](#layer-map)
4. [Request Lifecycle](#request-lifecycle)
5. [Context Threading Model](#context-threading-model)
6. [Package Structure](#package-structure)
7. [Framework Adapter Pattern](#framework-adapter-pattern)

---

## Design Principles

### 1. Middleware-First (ADR-007)
The SDK integrates as a standard HTTP middleware. It does not require framework-specific hooks, custom build steps, or database setup. A single function call is sufficient. This maximizes adoption and minimizes the integration surface.

### 2. Zero Human Impact
Human browser requests are detected in Layer 0 and exit the pipeline immediately. Every CPU cycle spent on agent logic is invisible to human users.

### 3. Progressive Disclosure
Every feature is opt-in and can be enabled independently. A minimal integration (just detection + markdown) adds less than 5ms latency. Full integration (all 8 layers) adds 10–30ms.

### 4. Context Is Immutable
The `AgentContext` object created in Layer 0 is frozen. Subsequent layers may create derived contexts (e.g., injecting `tenantContext`) but never mutate the original.

### 5. Framework Agnostic Core
`@agentfriendly/core` has zero framework dependencies. It operates on a framework-agnostic `AgentRequest` / `AgentResponse` interface. Framework adapters handle the translation to/from framework-native request/response types.

### 6. Edge Runtime Compatible
The core detection and access control layers are Edge-compatible (no Node.js-specific APIs). HTML→Markdown conversion gracefully falls back when `jsdom` is unavailable in Edge environments.

### 7. Stable Dependencies Only (ADR-002)
The SDK depends only on finalized or widely-adopted standards (RFC 9421, RFC 8693, x402 v1). Experimental specs like WebMCP are explicitly excluded until stable.

---

## High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          INCOMING REQUEST                               │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │   Framework Adapter          │
                    │   (Next / Express / Hono /   │
                    │    Nuxt / Astro / FastAPI …) │
                    │                              │
                    │   1. Translate to AgentRequest│
                    │   2. Call sdk.process()       │
                    │   3. Serve early response     │
                    │      OR inject headers and   │
                    │      call route handler       │
                    │   4. Post-process response   │
                    │      (HTML→Markdown)         │
                    └──────────────┬───────────────┘
                                   │ AgentRequest
                    ┌──────────────▼───────────────┐
                    │   AgentFriendlyMiddleware      │
                    │   (orchestrator)               │
                    └──────────────┬────────────────┘
                                   │
          ┌────────────────────────▼──────────────────────────────┐
          │  Layer 0: Detection Pipeline                           │
          │  ─────────────────────────────────────────────────    │
          │  Signal 1: Accept Header analysis                     │
          │  Signal 2: UA Database lookup (agents.json)           │
          │  Signal 3: HTTP Header Heuristics (7 checks)          │
          │  Signal 4: Identity Verification (RFC 9421 / AIT)     │
          │                                                        │
          │  → AgentContext (frozen, immutable)                    │
          │  → if tier == "human": skip all remaining layers      │
          └────────────────────────┬──────────────────────────────┘
                                   │ (agent request only)
          ┌────────────────────────▼──────────────────────────────┐
          │  Layer 8 (pre-flight): Multi-Tenancy                  │
          │  Validate X-Agent-Session JWT → inject TenantContext  │
          └────────────────────────┬──────────────────────────────┘
                                   │
          ┌────────────────────────▼──────────────────────────────┐
          │  Layer 1: Discovery Routing                            │
          │  If path in {/llms.txt, /.well-known/agent.json, …}  │
          │  → serve HandledResponse immediately                  │
          └────────────────────────┬──────────────────────────────┘
                                   │
          ┌────────────────────────▼──────────────────────────────┐
          │  Layer 4: Access Control                               │
          │  Policy engine → 403 Forbidden                        │
          │  Rate limiter  → 429 Too Many Requests                │
          └────────────────────────┬──────────────────────────────┘
                                   │
          ┌────────────────────────▼──────────────────────────────┐
          │  Layer 7: Monetization (x402)                         │
          │  Route pricing match + X-Payment verification         │
          │  → 402 Payment Required                               │
          └────────────────────────┬──────────────────────────────┘
                                   │
          ┌────────────────────────▼──────────────────────────────┐
          │  Layer 2: Content Negotiation (instructions only)     │
          │  Decide: convertToMarkdown? (tier + config + path)    │
          │  Build: Content-Signal header, debug headers          │
          │  → OrchestratorResult { contentInstructions }        │
          └────────────────────────┬──────────────────────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │   Route Handler (user code)   │
                    └──────────────┬───────────────┘
                                   │ HTML response
                    ┌──────────────▼───────────────┐
                    │   Content Post-Processing     │
                    │   (in Framework Adapter)      │
                    │                               │
                    │   jsdom + @mozilla/readability│
                    │   + turndown  (Node.js)        │
                    │   OR regex fallback (Edge)    │
                    └──────────────┬───────────────┘
                                   │ Markdown response
                    ┌──────────────▼───────────────┐
                    │   Response sent to Agent      │
                    └───────────────────────────────┘
```

---

## Layer Map

| # | Name | Responsibility | Early Exit? |
|---|------|---------------|-------------|
| 0 | Detection | Resolve `TrustTier` from 4 signals | — |
| 8* | Multi-Tenancy (pre) | Validate delegation JWT | — |
| 1 | Discovery | Serve static agent files | ✓ (200) |
| 4 | Access Control | Evaluate deny/allow policies | ✓ (403/429) |
| 7 | Monetization | x402 payment challenge | ✓ (402) |
| 2 | Content | Build markdown instructions | — |
| 3 | Analytics | (emitted asynchronously, no-op on critical path) | — |
| 5 | Privacy | (applied per-field in route handlers, not on the pipeline) | — |
| 6 | Tools | (registered at startup, invoked via POST /agent/tools/:id) | — |

\* Layer 8 runs before Layer 1 (before discovery file serving) to ensure discovery file requests can also carry tenant context.

---

## Request Lifecycle

### 1. Framework Adapter receives the request

```typescript
// Framework adapter translates native request to AgentRequest
const agentRequest: AgentRequest = {
  method: "GET",
  url: "https://example.com/blog/my-post",
  path: "/blog/my-post",
  headers: { "user-agent": "GPTBot/1.0", accept: "text/markdown" },
  body: null,
  query: {},
  ip: "198.51.100.1",
};
```

### 2. Orchestrator processes the request

```typescript
const result: OrchestratorResult = await sdk.process(agentRequest);
// result.context          → AgentContext (always populated)
// result.earlyResponse    → HandledResponse | null
// result.contentInstructions → {convertToMarkdown, agentHeaders, …}
```

### 3a. Early response path (discovery, 402, 403, 429)

```
result.earlyResponse !== null
  → adapter returns response directly, skips route handler
```

### 3b. Passthrough path (normal route handling)

```
result.earlyResponse === null
  → adapter calls route handler
  → adapter injects agentHeaders into response
  → if contentInstructions.convertToMarkdown:
      adapter converts HTML → Markdown before sending
```

---

## Context Threading Model

### TypeScript: AsyncLocalStorage

```typescript
// Set in middleware.ts
agentContextStorage.run(context, async () => {
  return await next(); // all code in this subtree can call getAgentContext()
});

// Read anywhere in the async call stack
import { getAgentContext } from "@agentfriendly/core";
const ctx = getAgentContext(); // → AgentContext | null
```

`AsyncLocalStorage` propagates the context automatically through all `await` calls, promise chains, and callbacks — including those in third-party libraries. No argument threading is required.

### Python: ContextVar

```python
# Set in middleware
_agent_context_var.set(context)

# Read anywhere in the same async task
from agentfriendly import get_agent_context
ctx = get_agent_context()  # → AgentContext | None
```

`ContextVar` propagates automatically through `asyncio` tasks. In sync Django/Flask adapters, a new event loop is used per request.

---

## Package Structure

```
websites_for_agents/
├── packages/
│   ├── core/               @agentfriendly/core
│   │   └── src/
│   │       ├── types/          All TypeScript interfaces
│   │       ├── detection/      Layer 0 — 4 signals + verifiers
│   │       ├── discovery/      Layer 1 — generators + router
│   │       ├── content/        Layer 2 — negotiator + html-to-markdown
│   │       ├── analytics/      Layer 3 — collector + adapters
│   │       ├── access/         Layer 4 — policy engine + rate limiter
│   │       ├── privacy/        Layer 5 — PII patterns + masker
│   │       ├── tools/          Layer 6 — registry + task queue
│   │       ├── monetization/   Layer 7 — x402 + pricing
│   │       ├── multitenancy/   Layer 8 — token issuer + CRL
│   │       ├── config.ts       resolveConfig()
│   │       └── middleware.ts   AgentFriendlyMiddleware orchestrator
│   │
│   ├── ua-database/        @agentfriendly/ua-database  (shared data)
│   │   └── data/agents.json
│   │
│   ├── next/               @agentfriendly/next
│   ├── express/            @agentfriendly/express
│   ├── hono/               @agentfriendly/hono
│   ├── nuxt/               @agentfriendly/nuxt
│   ├── astro/              @agentfriendly/astro
│   ├── cli/                @agentfriendly/cli
│   └── test-fixtures/      @agentfriendly/test-fixtures
│
├── python_sdk/
│   └── agentfriendly/
│       ├── detection/
│       ├── discovery/
│       ├── content/
│       ├── access/
│       ├── privacy/
│       ├── monetization/
│       ├── multitenancy/
│       ├── adapters/       fastapi.py, django.py, flask.py
│       ├── config.py
│       ├── middleware.py
│       └── types.py
│
├── docs-site/              Starlight documentation site
├── examples/
│   ├── next/
│   └── express/
└── docs/
    ├── adr/                Architecture Decision Records
    ├── architecture/       ← THIS FOLDER
    ├── landscape/          Existing solution explainers
    └── research/           Literature review + synthesis
```

---

## Framework Adapter Pattern

Every framework adapter implements the same 4-step pattern:

```
1. TRANSLATE  native request  → AgentRequest
2. CALL       sdk.process(agentRequest) → OrchestratorResult
3. SERVE      earlyResponse if present
4. WRAP       route handler + post-process response
```

The adapter is responsible for:
- Lowercasing all header keys (the core always expects lowercase).
- Normalizing the path (removing trailing slash, except root `/`).
- Injecting `result.contentInstructions.agentHeaders` into the outgoing response.
- Intercepting the HTML response body for HTML→Markdown conversion.

See individual architecture docs for each adapter's specifics.
