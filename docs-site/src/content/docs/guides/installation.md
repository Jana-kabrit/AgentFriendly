---
title: Installation
description: Install the AgentFriendly SDK for your runtime and framework.
---

# Installation

## TypeScript / Node.js Packages

```bash
# Next.js
pnpm add @agentfriendly/next

# Express.js
pnpm add @agentfriendly/express

# Hono (Cloudflare Workers)
pnpm add @agentfriendly/hono

# Nuxt 3
pnpm add @agentfriendly/nuxt

# Astro
pnpm add @agentfriendly/astro

# Core (framework-agnostic)
pnpm add @agentfriendly/core

# CLI (install globally)
pnpm add -g @agentfriendly/cli
```

## Python Package

```bash
# Base (no optional dependencies)
pip install agentfriendly

# With FastAPI support
pip install agentfriendly[fastapi]

# With Django support
pip install agentfriendly[django]

# With Flask support
pip install agentfriendly[flask]

# With HTML→Markdown conversion
pip install agentfriendly[content]

# Everything
pip install agentfriendly[fastapi,django,flask,content]
```

## Optional Peer Dependencies

### HTML → Markdown Conversion (Node.js)

For full HTML→Markdown conversion with content extraction:

```bash
pnpm add jsdom @mozilla/readability turndown
pnpm add -D @types/jsdom @types/turndown
```

If these are not installed, AgentFriendly falls back to a lightweight Edge Runtime-compatible regex stripper.

### x402 Monetization

No additional dependencies required — x402 payment verification is built into the core package.

### Cryptographic Identity Verification

For RFC 9421 signature verification, the `jose` package is required (already included in `@agentfriendly/core` dependencies):

```bash
pnpm add jose
```

## Peer Requirements

| Package                  | Required Peer    |
| ------------------------ | ---------------- |
| `@agentfriendly/next`    | `next >= 14.0`   |
| `@agentfriendly/express` | `express >= 4.0` |
| `@agentfriendly/hono`    | `hono >= 3.0`    |
| `@agentfriendly/nuxt`    | `nuxt >= 3.0`    |
| `@agentfriendly/astro`   | `astro >= 4.0`   |
| Python                   | `python >= 3.11` |
