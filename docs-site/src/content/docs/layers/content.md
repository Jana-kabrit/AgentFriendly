---
title: "Layer 2: Content Negotiation"
description: Automatically serve clean markdown to AI agents instead of complex HTML.
---

# Layer 2: Content Negotiation

Layer 2 converts your existing HTML responses to clean, token-efficient markdown for agent requests — without any changes to your route handlers.

## How It Works

1. After your route handler returns an HTML response, the middleware intercepts it.
2. The HTML is parsed using `jsdom` + `@mozilla/readability` to extract the main content.
3. Noisy elements (nav, footer, ads, scripts) are stripped.
4. The content is converted to clean markdown using `turndown`.
5. A token count estimate is added via the `X-Markdown-Tokens` header.

## Token Savings

Typical HTML pages contain a significant amount of noise:

| Page Type                | HTML Tokens | Markdown Tokens | Savings |
| ------------------------ | ----------- | --------------- | ------- |
| Blog post (with nav/ads) | ~8,000      | ~1,200          | ~85%    |
| Product listing          | ~12,000     | ~2,400          | ~80%    |
| Documentation page       | ~5,000      | ~1,800          | ~64%    |
| API reference            | ~15,000     | ~4,000          | ~73%    |

## Configuration

```typescript
createAgentFriendlyMiddleware({
  content: {
    // Enable HTML → Markdown conversion
    markdown: true,

    // Content-Signal header values
    signals: {
      "ai-train": false, // Don't allow training on your content
      "ai-input": true, // Allow use as LLM input (inference)
      search: true, // Allow AI search indexing
    },

    // Routes to exclude from markdown conversion
    excludeFromMarkdown: [
      "/api/**", // API endpoints serve JSON, not HTML
      "**/*.json", // JSON routes
    ],

    // Additional CSS selectors to strip before conversion
    stripSelectors: [".ads", ".cookie-banner", ".newsletter-popup"],

    // Include X-Markdown-Tokens estimate header
    tokenHeader: true,

    // Serve ?md=1 suffix for easy testing
    mdUrlSuffix: true,
  },
});
```

## Content-Signal Header

Every agent response includes the `Content-Signal` header:

```
Content-Signal: ai-train=no, ai-input=yes, search=yes
```

This is read by AI agents to understand your content usage policy.

## Default Strip Selectors

These elements are always stripped before conversion:

```
nav, footer, aside, script, style, noscript, iframe,
header nav, .ads, .advertisement, .cookie-banner, .sidebar
```

## Edge Runtime Compatibility

In Edge Runtime environments (Next.js Edge Middleware, Cloudflare Workers), `jsdom` is not available. AgentFriendly automatically falls back to a lightweight regex-based stripper that works without Node.js APIs.

For full conversion quality in Edge environments, convert HTML on the origin server and cache the markdown response.

## Testing Conversion

```bash
# See the markdown that GPTBot would receive
agentfriendly preview --url http://localhost:3000/blog/my-post
```

Or add `?md=1` to any URL (when `mdUrlSuffix: true`):

```
http://localhost:3000/blog/my-post?md=1
```
