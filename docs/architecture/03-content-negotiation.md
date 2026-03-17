# Layer 2: Content Negotiation

Content negotiation is the most impactful layer for LLM-driven agents. It converts your existing HTML pages into clean, token-efficient Markdown before they reach the agent — with zero changes required to your route handlers.

## What It Solves

A typical HTML blog post:

- HTML: ~15,000 characters, ~3,750 tokens → **$0.0066** at GPT-5.3 input pricing
- After readability + Markdown: ~2,800 characters, ~700 tokens → **$0.0012** at GPT-5.3 input pricing
- **Token reduction: ~81%**

Real-world measurements are even more dramatic. The Checkly documentation site measured a single page at 180,573 HTML tokens vs. 478 markdown tokens — a **99.7% reduction**. At GPT-5.3 input pricing ($1.75/M tokens), that is the difference between $0.32 and $0.0008 per page read.

This is not just about size. HTML contains navigation bars, cookie banners, script tags, and structural noise that has no semantic value for an LLM but inflates its context window significantly.

---

## Markdown vs. HTML: What Agents Actually Get

### Input HTML (simplified)

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Getting Started with Our API</title>
  </head>
  <body>
    <nav>...navbar with 20 links...</nav>
    <div class="cookie-banner">Accept cookies...</div>
    <main>
      <h1>Getting Started with Our API</h1>
      <p>Our REST API lets you access all platform features programmatically.</p>
      <h2>Authentication</h2>
      <p>All requests must include an <code>Authorization: Bearer &lt;token&gt;</code> header.</p>
    </main>
    <footer>...footer with 15 links...</footer>
    <script src="analytics.js"></script>
  </body>
</html>
```

### Output Markdown

```markdown
# Getting Started with Our API

Our REST API lets you access all platform features programmatically.

## Authentication

All requests must include an `Authorization: Bearer <token>` header.
```

---

## The `text/markdown` Adoption Problem

Most LLM agents do not yet send `Accept: text/markdown` in their requests (see [landscape/01-content-negotiation.md](../landscape/01-content-negotiation.md)). The SDK addresses this with a **proactive markdown** strategy controlled by `content.proactiveMarkdown`.

```
proactiveMarkdown: "suspected" | "known" | "verified" | false
```

| Value         | Effect                                                                   |
| ------------- | ------------------------------------------------------------------------ |
| `false`       | Only serve markdown when `Accept: text/markdown` is explicitly requested |
| `"suspected"` | Serve markdown for all tiers ≥ suspected-agent (catches most traffic)    |
| `"known"`     | Serve markdown for known-agent and verified-agent tiers only             |
| `"verified"`  | Serve markdown only for cryptographically verified agents                |

The default is `"known"` — a safe middle ground that avoids false positives from API clients while serving the majority of real LLM agents.

---

## HTML→Markdown Conversion Pipeline

The conversion uses a three-library pipeline with progressive enhancement:

```
HTML string
    │
    ▼
┌───────────────────────────────┐
│ 1. jsdom                      │
│    Parse HTML into a DOM tree │
└───────────────┬───────────────┘
                │ Document
                ▼
┌───────────────────────────────┐
│ 2. @mozilla/readability       │
│    Extract main content,      │
│    strip navs/ads/footers     │
└───────────────┬───────────────┘
                │ Article { title, content }
                ▼
┌───────────────────────────────┐
│ 3. turndown                   │
│    Convert HTML → Markdown    │
│    (fenced code blocks,       │
│     tables, strikethrough)    │
└───────────────┬───────────────┘
                │ Markdown string
                ▼
         Token estimation
         → x-markdown-tokens header
```

### Edge Runtime Fallback

`jsdom` requires Node.js APIs and cannot run in Cloudflare Workers or Next.js Edge Runtime. When detected, the pipeline falls back to:

```
HTML string
    │
    ▼
┌───────────────────────────────┐
│ Regex HTML stripper           │
│ Removes tags, scripts, styles │
│ Preserves text content        │
└───────────────────────────────┘
```

The fallback produces plain text, not structured Markdown. It is less token-efficient but never throws.

---

## Content-Signal Header

The SDK injects a `Content-Signal` header on all agent responses to declare the AI usage rights of the content, following Cloudflare's Content Signals spec:

```
Content-Signal: ai-training=disallowed; ai-inference=allowed; ai-indexing=allowed
```

Configured via `content.contentSignals`:

```typescript
contentSignals: {
  aiTraining: "disallowed" | "allowed" | "conditional";
  aiInference: "allowed" | "disallowed";
  aiIndexing: "allowed" | "disallowed";
}
```

---

## Token Estimation

The `x-markdown-tokens` response header provides an approximate token count of the markdown body, helping agents decide whether to pass the full content or summarize:

```
x-markdown-tokens: 742
```

Token estimation uses the standard `chars / 4` heuristic (a conservative approximation for English text on cl100k-style tokenizers). This is fast and allocation-free.

---

## Path Exclusions

Certain paths should never be converted to Markdown (e.g., JSON APIs, file downloads):

```typescript
content: {
  excludePaths: ["/api/**", "/static/**", "*.json", "*.csv"],
}
```

Exclusion is evaluated using glob patterns against the request path. Matched paths always receive HTML responses.

---

## Content Negotiation Decision Tree

```
Request arrives
    │
    ├── Is tier "human"?
    │      └── YES → Never convert. Skip entirely.
    │
    ├── Is path excluded?
    │      └── YES → Never convert.
    │
    ├── Does Accept header explicitly request text/markdown?
    │      └── YES → Convert regardless of proactiveMarkdown setting.
    │
    └── Does tier meet proactiveMarkdown threshold?
           ├── YES → Convert.
           └── NO  → Don't convert (serve original HTML).
```

---

## Response Headers Injected

| Header              | Example                                        | Purpose                                                         |
| ------------------- | ---------------------------------------------- | --------------------------------------------------------------- |
| `Content-Type`      | `text/markdown; charset=utf-8`                 | Signals markdown body                                           |
| `x-markdown-tokens` | `742`                                          | Approximate token count                                         |
| `Content-Signal`    | `ai-training=disallowed; ai-inference=allowed` | AI usage rights                                                 |
| `Vary`              | `Accept`                                       | Ensures correct CDN caching when serving both HTML and markdown |
