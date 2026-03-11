---
title: agentfriendly validate
description: Validate your site's agent-friendly implementation.
---

# agentfriendly validate

Validates that a site correctly implements the AgentFriendly specification by checking all discovery files and markdown serving behavior.

## Usage

```bash
agentfriendly validate [--url <url>]
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--url <url>` | `http://localhost:3000` | The site URL to validate |

## Checks Performed

1. **`/.well-known/agent.json`** — Must return valid JSON with `ahp`, `modes`, and `name` fields.
2. **`/llms.txt`** — Must return `text/markdown` Content-Type.
3. **`/.well-known/agent-tools.json`** — Optional; must be valid JSON if present.
4. **`/robots.txt`** — Optional; warns if missing.
5. **Markdown serving** — Sends a `GPTBot/1.0` request and checks for `text/markdown` response.

## Example Output

```
  🤖 Validating: https://mysite.com
  ──────────────────────────────────────────────

  · Checking agent manifest...
  ✓ /.well-known/agent.json  — valid JSON
    ahp version           0.1
    modes                 MODE1, MODE2
    name                  My Product

  · Checking /llms.txt...
  ✓ /llms.txt — accessible

  · Checking agent tool definitions...
  ✓ /.well-known/agent-tools.json — valid JSON

  · Checking /robots.txt...
  ✓ /robots.txt — accessible

  · Checking markdown serving for agent UA...
  ✓ / responds with text/markdown for agent Accept header
    estimated tokens      1247

  5/5 checks passed
  ✓ All checks passed! Your site is agent-friendly.
```
