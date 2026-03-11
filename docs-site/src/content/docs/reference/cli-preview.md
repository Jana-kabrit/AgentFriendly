---
title: agentfriendly preview
description: Preview what an AI agent sees when visiting a URL.
---

# agentfriendly preview

Fetches a URL as an AI agent and shows the markdown response — so you can see exactly what GPTBot, Claude, and other agents experience on your site.

## Usage

```bash
agentfriendly preview [--url <url>] [--ua <user-agent>]
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--url <url>` | `http://localhost:3000/` | The URL to preview |
| `--ua <string>` | `GPTBot/1.0` | User-Agent to use for the request |

## Examples

```bash
# Preview your local site
agentfriendly preview

# Preview a specific page
agentfriendly preview --url http://localhost:3000/blog/my-post

# Preview a production site
agentfriendly preview --url https://example.com

# Preview as a different agent
agentfriendly preview --url https://example.com --ua "ClaudeBot/1.0"
```

## Example Output

```
  🤖 Agent Preview: http://localhost:3000/blog/my-post
  ──────────────────────────────────────────────

    User-Agent              GPTBot/1.0 (compatible; @agentfriendly/cli)
    Accept                  text/markdown, text/html;q=0.5

    HTTP status             200
    Content-Type            text/markdown; charset=utf-8
    x-markdown-tokens       1247
    x-agentfriendly-tier    known-agent
    content-signal          ai-train=no, ai-input=yes, search=yes

  ✓ Server is serving markdown to this agent.

  Content preview (first 2000 chars):

  # My Blog Post

  Published on March 8, 2026 by Jane Doe.

  In this post, we explore the latest developments in AI agent
  infrastructure and how AgentFriendly can help...

  ... (847 more characters)
```
