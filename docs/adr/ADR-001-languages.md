# ADR-001: Language and Runtime Choice

**Status**: Accepted  
**Date**: March 2026

## Context

The SDK must be usable by the widest possible range of web developers. The primary use cases are:
1. Adding agent-friendly capabilities to an existing website
2. Serving as middleware in a web framework
3. Being installed as a package with minimal setup

## Options Considered

**Option A: TypeScript only**  
Covers Node.js ecosystem (Next.js, Express, Nuxt, Astro, Hono). Does not cover Python-heavy backends.

**Option B: Python only**  
Covers FastAPI, Django, Flask. Does not cover the Node.js-dominated frontend framework market.

**Option C: TypeScript + Python, sharing a language-agnostic JSON UA database**  
Covers both ecosystems. The agent UA database is a language-agnostic JSON file read by both packages. No data duplication.

## Decision

**Option C: TypeScript + Python.**

TypeScript is published to npm as `@agentfriendly/*` packages. Python is published to PyPI as `agentfriendly`. Both packages load the same `data/agents.json` file from the `@agentfriendly/ua-database` npm package (TypeScript) and from the `agentfriendly` PyPI package which vendors the same JSON (Python).

## Rationale

- TypeScript covers the largest web framework market (Next.js, Express, Nuxt, Astro, Hono/Cloudflare Workers)
- Python covers the AI/ML ecosystem where many agent backends and SaaS backends live (FastAPI, Django, Flask)
- The `webagents.md` reference SDK (browser-use) is Python-first — Python parity ensures feature completeness
- Maintaining parity from day one prevents the Python SDK from becoming permanently second-class
- The JSON UA database eliminates the risk of the two SDKs diverging in their agent detection behavior

## Consequences

- Each SDK layer must be implemented twice (TypeScript and Python)
- CI must run tests for Python 3.11, 3.12, and 3.13 in addition to Node.js 20+
- The UA database JSON schema is the source of truth for both; changes to the schema require updates to both loaders
