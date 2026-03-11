# ADR-007: Middleware-First Architecture with Thin Framework Adapters

**Status**: Accepted  
**Date**: March 2026

## Context

The SDK must work across multiple web frameworks (Next.js, Express, Hono, Nuxt, Astro) and runtimes (Node.js, Cloudflare Workers, Deno). The choice of architecture determines how much of the logic can be shared vs. duplicated per framework.

## Options Considered

**Option A: Framework-specific packages with duplicated logic**  
`@agentfriendly/next` contains Next.js logic, `@agentfriendly/express` contains Express logic, etc. Business logic is duplicated. A bug fix requires changes in every package.

**Option B: Single package with framework detection**  
One package detects the framework at runtime and adjusts. Fragile. Framework internals change; detection breaks.

**Option C: Core package + thin adapters**  
`@agentfriendly/core` contains all business logic with a framework-agnostic interface. Framework adapters (`@agentfriendly/next`, `@agentfriendly/express`, etc.) are thin wrappers that translate framework-specific request/response objects to the core's interface.

## Decision

**Option C: Core package + thin framework adapters.**

## Rationale

- All 8 layers (detection, discovery, content, analytics, access, privacy, tools, monetization, multitenancy) live in `@agentfriendly/core`. A bug fix or improvement to any layer benefits all frameworks instantly.
- Framework adapters contain only: (1) request/response object translation, (2) framework-specific startup hooks (route scanning at build time for Next.js), (3) edge-specific overrides (D1 instead of SQLite for Cloudflare Workers).
- Adding a new framework in the future (e.g., Fastify, Bun.serve()) requires writing only a thin adapter, not reimplementing 8 layers.
- The core package's interface is a single function: `processAgentRequest(req: AgentRequest): Promise<AgentResponse>`. Adapters convert to/from this shape.

## Constraints from Framework Runtimes

- **Cloudflare Workers (Edge Runtime)**: No Node.js built-ins. `better-sqlite3` is unavailable. The Hono adapter substitutes Cloudflare D1 (SQLite-compatible) for analytics and KV for rate limiting and token CRL.
- **Next.js Edge Middleware**: Runs in the Edge Runtime. Same constraints as Cloudflare Workers. The Next.js adapter uses Edge-compatible substitutes and lazy-loads Node.js-specific modules only in Node.js route handlers.
- **Vercel/Node.js Runtime**: Full Node.js built-ins available. All features supported.

## Consequences

- `@agentfriendly/core` must be written to avoid Node.js built-ins in its hot path. Node.js-specific code (SQLite, `crypto.createVerify`) is hidden behind interfaces that adapters can override.
- The public API surface of each adapter package is identical (same config shape, same `agentMeta` export format). Switching from Express to Next.js requires only changing the import and adapter configuration.
