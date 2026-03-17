# Content Negotiation: `Accept: text/markdown`

## What It Is

HTTP content negotiation is a standard mechanism (part of HTTP/1.1 since 1997) that lets a client tell a server what format it prefers for a response. The server reads the `Accept` header and returns the best format it can provide.

For AI agents, this is used to request markdown instead of HTML:

```
Accept: text/markdown, text/html, */*
```

When the server sees `text/markdown` listed first (or with a quality factor higher than `text/html`), it knows the client prefers markdown. If the server supports it, it returns the same content as a clean markdown string instead of a full HTML document.

## Why It Matters

A typical documentation page weighs 500 KB as HTML (including stylesheets, JavaScript, navigation, footers, and cookie banners). The actual content — the thing an agent came for — is 2 KB as markdown.

Measured by tokens, the same page is 180,573 tokens as raw HTML and 478 tokens as markdown. That is a 99.7% reduction. At $1.75/million input tokens (GPT-5.3 pricing), that changes the cost of reading one page from $0.32 to $0.0008.

## How It Works Technically

### The Request

The agent sends a normal HTTP GET request with an additional header:

```bash
# Claude Code's actual header
Accept: text/markdown, text/html, */*

# Cursor's actual header (uses quality factors)
Accept: text/markdown,text/html;q=0.9,application/xhtml+xml;q=0.8,application/xml;q=0.7,image/webp;q=0.6,*/*;q=0.5

# OpenCode's actual header
Accept: text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7, */*;q=0.1
```

The `q=` suffix is a quality factor between 0 and 1. Higher means more preferred. When no `q` is specified (Claude Code), the order of types in the header determines preference — leftmost wins.

### The Server Response

A server that supports markdown negotiation checks the Accept header and, if markdown is preferred, returns:

```
HTTP/1.1 200 OK
Content-Type: text/markdown
Content-Signal: ai-train=no, ai-input=yes, search=yes
x-markdown-tokens: 478

# Getting Started

To install the SDK, run...
```

A server that does not support markdown ignores the preference and returns HTML as normal. The agent falls back to parsing HTML.

### The Fallback: `.md` URL Suffix

A simpler approach used by some sites: requesting `https://example.com/docs/getting-started.md` returns the markdown version. The `.md` suffix is stripped, the underlying route is fetched, and the content is converted to markdown. This works for any HTTP client, even ones that do not send `Accept` headers.

## Who Has Implemented It

| Organization | Implementation                  | Status                  |
| ------------ | ------------------------------- | ----------------------- |
| Vercel       | Next.js middleware + Contentful | Feb 2026, live          |
| Checkly      | Documentation site              | Feb 2026, live          |
| Cloudflare   | CDN-level (see Explainer 08)    | Feb 2026, 3.8M+ domains |
| Anthropic    | llms.txt + .md suffix           | Active                  |

## Which Agents Send It

As of February 2026 (source: Checkly's live study):

| Agent                 | Sends Accept: text/markdown | Accept Header Value             |
| --------------------- | --------------------------- | ------------------------------- |
| Claude Code (v2.1.38) | ✅ Yes                      | `text/markdown, text/html, */*` |
| Cursor (2.4.28)       | ✅ Yes                      | With quality factors            |
| OpenCode (1.2.5)      | ✅ Yes                      | With quality factors            |
| OpenAI Codex          | ❌ No                       | Standard browser Accept         |
| Gemini CLI (0.28.2)   | ❌ No                       | `*/*`                           |
| GitHub Copilot        | ❌ No                       | Standard browser Accept         |
| Windsurf (1.9552.21)  | ❌ No                       | `*/*`                           |

**Only 3 of 7 major agents send this header.** This is the "text/markdown adoption problem" — the reason `@agentfriendly` uses a multi-signal detection pipeline (UA database, header heuristics) rather than relying on this header alone.

## How `@agentfriendly` Differs

Content negotiation is Layer 2 of the SDK. The difference:

1. **@agentfriendly also serves markdown to agents that don't send the header** — by using the trust tier from Layer 0 (UA database match) and the `proactiveMarkdown` config setting. This covers the 4 agents above that miss the accept header.

2. **@agentfriendly works on any framework and any infrastructure** — Cloudflare's markdown for agents requires you to be on Cloudflare. Vercel's implementation requires Next.js + Contentful. This SDK works on Express, Hono, Nuxt, Astro, FastAPI, Django, and Flask.

3. **@agentfriendly pairs content serving with access control, analytics, identity verification, and monetization** — not just content format conversion.

## Quick Implementation Reference

```typescript
// Minimal implementation without the SDK (for reference)
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";

function acceptsMarkdown(acceptHeader: string | undefined): boolean {
  if (!acceptHeader) return false;
  const parts = acceptHeader.split(",").map((p) => p.trim());
  const mdPart = parts.find((p) => p.startsWith("text/markdown"));
  const htmlPart = parts.find((p) => p.startsWith("text/html"));
  if (!mdPart) return false;
  const mdQ = parseQ(mdPart);
  const htmlQ = htmlPart ? parseQ(htmlPart) : 0.9;
  return mdQ >= htmlQ;
}

function parseQ(part: string): number {
  const match = /;q=([\d.]+)/.exec(part);
  return match ? Number(match[1]) : 1.0;
}

// In your Express middleware:
app.use((req, res, next) => {
  if (acceptsMarkdown(req.headers.accept)) {
    // Intercept response, convert HTML to markdown
  }
  next();
});
```
