---
title: agentfriendly init
description: Interactive setup wizard for AgentFriendly.
---

# agentfriendly init

Interactive setup wizard that detects your framework and generates a ready-to-use configuration file.

## Usage

```bash
agentfriendly init [options]
```

## Options

| Option | Description |
|--------|-------------|
| `--framework <name>` | Skip framework detection and use the specified framework |
| `--force` | Overwrite existing config file without prompting |

## Interactive Prompts

1. **Framework** — Detects from `package.json` or prompts you to select.
2. **Proactive markdown** — When to serve markdown without an explicit `Accept` header.
3. **Training crawlers** — Whether to block GPTBot, ClaudeBot, etc.
4. **Monetization** — Whether to enable x402 payments (requires a wallet address).

## Output

Writes a configuration file based on your framework:

| Framework | Output File |
|-----------|------------|
| Next.js | `middleware.ts` |
| Express | `src/middleware.ts` |
| Hono | `src/middleware.ts` |
| Nuxt 3 | `nuxt.config.ts` |
| Astro | `src/middleware.ts` |

## Examples

```bash
# Auto-detect framework
agentfriendly init

# Force Next.js config
agentfriendly init --framework next

# Overwrite existing file
agentfriendly init --force
```
