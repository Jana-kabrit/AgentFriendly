# Framework Adapters

Framework adapters translate between framework-native request/response objects and the SDK's `AgentRequest` / `AgentResponse` interface. All adapters implement the same 4-step pattern, but differ in how they hook into each framework's lifecycle.

---

## Common Pattern

Every adapter follows this structure:

```
1. TRANSLATE   native request → AgentRequest
2. CALL        sdk.process(agentRequest) → OrchestratorResult
3. SERVE       earlyResponse if present (early exit)
4. WRAP        route handler: inject headers, then post-process HTML → Markdown
```

The key constraint: **HTML→Markdown conversion must happen _after_ the route handler has returned its response body**. Each adapter has a different mechanism for intercepting that post-response body.

---

## Next.js (`@agentfriendly/next`)

### Runtime Environments

- **Edge Runtime** (Cloudflare Workers, Vercel Edge): Markdown conversion uses the regex fallback (no `jsdom`).
- **Node.js Runtime** (Vercel, self-hosted): Full `jsdom` + readability + turndown pipeline.

### Integration Points

**`middleware.ts`** (global request handler, runs before routing):

```typescript
import { createAgentFriendlyMiddleware } from "@agentfriendly/next";

const sdk = createAgentFriendlyMiddleware({
  /* config */
});

export function middleware(req: NextRequest) {
  return sdk(req);
}
export const config = { matcher: ["/((?!_next|favicon).*)"] };
```

The middleware intercepts `NextRequest`, calls `sdk.process()`, handles early responses, and for passthrough requests it injects the `X-AgentFriendly-*` internal headers. The route handler's response is intercepted via `NextResponse` body replacement.

**`withAgentFriendly` HOC** (per-route):

```typescript
export const GET = withAgentFriendly(async (req) => {
  return NextResponse.json({ products: [...] });
}, { /* per-route config overrides */ });
```

### Header Normalization

Next.js headers are immutable once created. The adapter creates a new `Headers` object with the merged set.

---

## Express (`@agentfriendly/express`)

### Integration

```typescript
import { createAgentFriendlyMiddleware } from "@agentfriendly/express";

app.use(
  createAgentFriendlyMiddleware({
    /* config */
  }),
);
```

### Body Interception

Express adapters must intercept `res.send()` and `res.json()` to apply markdown conversion. The adapter patches these methods on `res` for agent requests:

```
req arrives
  → sdk.process() → earlyResponse? → res.send(earlyResponse) and return
  → next()                                        ↑
  → route handler calls res.send(html)             │
      → intercepted: if convertToMarkdown           │
          → convert html → markdown                 │
          → call original res.send(markdown) ───────┘
```

### `AsyncLocalStorage` propagation

The `AgentContext` is stored in `AsyncLocalStorage` keyed to the request's lifecycle. Express's `next()` mechanism does not break this propagation.

---

## Hono (`@agentfriendly/hono`)

Hono is the adapter used for **Cloudflare Workers** deployments. It uses Hono's `Context` and `Variables` pattern to thread agent context.

```typescript
import { createAgentFriendlyMiddleware } from "@agentfriendly/hono";

app.use(
  "*",
  createAgentFriendlyMiddleware({
    /* config */
  }),
);
```

### Key Difference: Hono Context Variables

Because Cloudflare Workers do not support Node.js `AsyncLocalStorage`, the Hono adapter stores `AgentContext` in `c.var.agentContext`:

```typescript
const ctx = c.var.agentContext; // from within a Hono route handler
```

### Response Interception

Hono's `await next()` pattern allows post-response processing:

```typescript
await next();
// c.res is now populated by the route handler
if (contentInstructions.convertToMarkdown) {
  const html = await c.res.text();
  const markdown = await htmlToMarkdown(html);
  c.res = new Response(markdown, { headers: mergedHeaders });
}
```

---

## Nuxt (`@agentfriendly/nuxt`)

Nuxt 3 uses h3 as its HTTP framework. The adapter provides a Nuxt **Module** that auto-registers a server middleware.

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["@agentfriendly/nuxt"],
  agentFriendly: {
    /* config */
  },
});
```

### How the Module Works

1. `module.ts` reads `nuxt.options.runtimeConfig.agentFriendly` config.
2. Adds the server middleware to Nuxt's server middleware stack.
3. The middleware file (`runtime/middleware.ts`) initializes `AgentFriendlyMiddleware` and runs on every SSR request.

### H3 Event Handling

The adapter translates `H3Event` to `AgentRequest` and uses `sendStream` / `setHeaders` for early responses.

---

## Astro (`@agentfriendly/astro`)

Astro's SSR middleware uses the `onRequest` hook:

```typescript
// astro.config.mjs
import { agentFriendly } from "@agentfriendly/astro";

export default defineConfig({
  integrations: [
    agentFriendly({
      /* config */
    }),
  ],
  output: "server",
});
```

### Integration Approach

The Astro integration (`integration.ts`) injects the AgentFriendly middleware into Astro's server middleware chain by writing a `middleware.ts` file to the project's `src/` directory (or by prepending to the existing one).

### Static vs. SSR

- **SSR mode**: Full pipeline with HTML→Markdown conversion.
- **Static mode**: Only detection and discovery files are meaningful. Markdown must be pre-generated at build time.

---

## Python Adapters

### FastAPI / Starlette (`agentfriendly.adapters.fastapi`)

```python
from agentfriendly.adapters.fastapi import AgentFriendlyMiddleware

app.add_middleware(AgentFriendlyMiddleware, config=config)
```

ASGI middleware wraps the app's call stack. Response body is collected via `scope/receive/send` intercept.

### Django (`agentfriendly.adapters.django`)

```python
# settings.py
MIDDLEWARE = [
  "agentfriendly.adapters.django.AgentFriendlyMiddleware",
  ...
]
```

Django middleware uses `process_request` for early exits and wraps `get_response` for HTML→Markdown.

### Flask (`agentfriendly.adapters.flask`)

```python
from agentfriendly.adapters.flask import init_app

init_app(app, config=config)
```

Flask uses `before_request` and `after_request` hooks. `ContextVar` propagates through Flask's request context.

---

## Translation Reference

The `AgentRequest` interface that all adapters must produce:

```typescript
interface AgentRequest {
  method: string; // "GET", "POST", etc.
  url: string; // Full URL including query string
  path: string; // Pathname only, no query string
  headers: Record<string, string>; // ALL keys lowercased
  body: string | null; // Request body as string
  query: Record<string, string>; // Parsed query params
  ip: string; // Client IP (after proxy headers)
}
```

Header normalization (lowercase) is the **adapter's responsibility**. The core never normalizes headers.
