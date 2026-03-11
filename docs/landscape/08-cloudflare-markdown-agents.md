# Cloudflare Markdown for Agents

## What It Is

Cloudflare "Markdown for Agents" is a CDN-level feature that automatically converts HTML responses to markdown when an AI agent requests it via `Accept: text/markdown`. It was introduced in February 2026 and is available to all sites using Cloudflare as their CDN.

The key insight: instead of site owners writing custom middleware, Cloudflare does the HTML→markdown conversion at the edge before the response reaches the agent.

## How It Works

1. An AI agent sends `GET /docs/getting-started` with `Accept: text/markdown`
2. Cloudflare's edge network intercepts the response from your origin server
3. If "Markdown for Agents" is enabled for your zone, Cloudflare converts the HTML to markdown using its own conversion pipeline
4. Cloudflare responds to the agent with `Content-Type: text/markdown`

Two additional headers are added to the response:
- `x-markdown-tokens: 478` — estimated token count of the markdown content
- `content-signal: ai-train=yes, search=yes, ai-input=yes` — default content usage signals (configurable)

## Performance Measurements

Cloudflare's own announcement blog post measured:

- HTML version: 16,180 tokens
- Markdown version: 3,150 tokens
- **Reduction: 80%**

## Content Signals

Alongside Markdown for Agents, Cloudflare introduced "Content Signals" — HTTP response headers that declare how your content may be used by AI systems:

```
content-signal: ai-train=no, ai-input=yes, search=yes
```

Three signals:
- **`ai-train`**: May this content be used for training or fine-tuning LLMs?
- **`ai-input`**: May this content be used for real-time retrieval (RAG, context injection)?
- **`search`**: May this content be used for traditional search indexing?

Cloudflare deployed these signals to over 3.8 million domains with a default of `search=yes, ai-train=no`. The legal framing is based on Article 4 of EU Directive 2019/790 (text and data mining reservation of rights).

You can configure per-page or per-directory signal overrides in the Cloudflare dashboard.

## How to Enable It

1. Log into the Cloudflare dashboard
2. Select your zone
3. Navigate to "Caching" → "Markdown for Agents"
4. Toggle it on

No code changes required. No npm packages. No middleware.

## Limitations

**Requires Cloudflare as your CDN**: This is a Cloudflare-specific feature. Sites on AWS CloudFront, Fastly, or self-hosted do not have access to it.

**Only responds to explicit Accept header**: Cloudflare's markdown conversion only triggers when `Accept: text/markdown` is present in the request. It does not proactively serve markdown to known agents that do not send this header (the 4/7 agents identified by Checkly's study).

**No access control**: Cloudflare Markdown for Agents does not distinguish between different types of agents. All agents that send `Accept: text/markdown` receive markdown — there is no way to deny access, require verification, or charge for access at this layer.

**No analytics**: Cloudflare does not provide per-agent breakdown analytics for markdown requests (only aggregate metrics).

## Technical Detail: How the Conversion Works

Cloudflare's conversion pipeline:
1. Origin serves HTML (200 OK, Content-Type: text/html)
2. Cloudflare intercepts at edge, runs an HTML parser
3. Strips `<nav>`, `<footer>`, `<aside>`, `<script>`, `<style>`, cookie banners (heuristic-based)
4. Converts the remaining content to markdown
5. Adds `x-markdown-tokens` header (estimated with cl100k_base tokenizer approximation)
6. Serves markdown to the agent

The `x-markdown-tokens` header allows agents to be informed about the expected context cost before processing the response.

## How `@agentfriendly` Differs

Cloudflare Markdown for Agents solves the content format problem. `@agentfriendly` solves the entire agent lifecycle problem.

Specifically, `@agentfriendly`:
- Works on **any infrastructure** (no Cloudflare required)
- **Proactively serves markdown** to known agents even without the Accept header
- Adds **access control** (deny training crawlers, require verified identity for premium content)
- Adds **agent analytics** (self-hosted, per-agent breakdown)
- Adds **monetization** (x402 per-request or per-token pricing)
- Adds **tool registration** (agents can call actions, not just read content)
- Adds **multi-tenant scoping** (agents act on behalf of specific users)
- Adds **PII masking** (fields are redacted in agent responses)

If you are on Cloudflare and only need content format optimization, enabling Markdown for Agents is a free, zero-code improvement. For everything beyond that, `@agentfriendly` provides the complete solution.
