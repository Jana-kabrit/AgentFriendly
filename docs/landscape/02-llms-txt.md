# llms.txt — The AI Sitemap

## What It Is

`llms.txt` is a proposed standard for websites to provide curated, LLM-friendly information about their content. It is placed at the root of a website at `https://yourdomain.com/llms.txt`. Think of it as `robots.txt` for LLMs — but instead of telling crawlers where not to go, it tells AI models what your site is about and where the most important content lives.

The proposal is maintained at [llmstxt.org](https://llmstxt.org).

## Format Specification

A valid `llms.txt` file must follow this markdown structure:

```markdown
# Project Name

> Short one-paragraph description of the project. This is the most important part —
> it is included in agent context even when the full file is not.

Optional descriptive paragraphs about the project. Can include
what the project does, who it is for, and key features.

## Section Name

- [Page Title](https://example.com/page): Short description of what this page contains
- [Another Page](https://example.com/another): Description

## Optional

- [Large Reference Doc](https://example.com/reference): Only include if agent needs it
```

**Required**:

- H1 header (the project name)
- A blockquote immediately after the H1 (short summary of the project)

**Optional**:

- Additional paragraphs
- H2-headed sections with lists of links
- An "Optional" section for content that is useful but large enough to skip if context is limited

## The `.md` URL Convention

Pages linked from `llms.txt` should have clean markdown versions accessible at the same URL with `.md` appended:

```
https://example.com/docs/getting-started      → HTML for humans
https://example.com/docs/getting-started.md   → Markdown for agents
```

URLs without a file extension append `index.html.md`:

```
https://example.com/docs/       → HTML
https://example.com/docs/index.html.md  → Markdown
```

## The `llms-ctx.txt` Expanded Form

Some sites also provide an `llms-ctx.txt` that is a full expansion of `llms.txt` — all linked pages have been fetched and their content is concatenated into a single file. This allows agents to load all documentation in a single request.

The `llms_txt2ctx` command-line tool (available via `npx`) generates this file automatically from a `llms.txt` source.

## Real Examples

**Cloudflare** (`https://developers.cloudflare.com/llms.txt`):

```markdown
# Cloudflare Developer Platform

> Cloudflare is a global network designed to make everything you connect to the internet secure, private, fast, and reliable.

## Products

- [Workers](https://developers.cloudflare.com/workers/llms-full.txt): Serverless code execution at Cloudflare's edge
- [R2](https://developers.cloudflare.com/r2/llms-full.txt): Object storage
  ...
```

**FastHTML** (`https://docs.fastht.ml/llms.txt`):

```markdown
# FastHTML

> FastHTML is a Python web framework designed for building web applications.
> ...
```

## Adoption Status (March 2026)

`llms.txt` is a proposed standard with growing developer adoption but limited adoption from major AI platforms. ChatGPT, Claude, and Gemini do not currently check `llms.txt` before web searches. However:

- Developer tools (Claude Code, Cursor) do check `llms.txt` when told to "read the docs"
- Search engines are beginning to index `llms.txt` contents
- It is a low-friction, backwards-compatible addition to any site

## How `@agentfriendly` Differs

`llms.txt` is a static file that a developer writes and maintains manually. `@agentfriendly` **auto-generates `llms.txt`** from your route registry and `agentMeta` annotations.

When you annotate a route handler with `agentMeta`, the SDK includes it in the generated `llms.txt` automatically. You can also add manual entries for pages without route handlers (marketing pages, blog posts, etc.).

```typescript
// agentfriendly.config.ts
export default {
  discovery: {
    llmsTxt: {
      title: "My SaaS Platform",
      description: "A platform for managing...",
      manualEntries: [{ url: "/blog/getting-started", description: "Quick start guide" }],
    },
  },
};
```

The generated `llms.txt` is served at `/llms.txt` and updated automatically when routes or annotations change.
