# ADR-002: Exclude WebMCP from Core Scope

**Status**: Accepted  
**Date**: March 2026

## Context

WebMCP (Web Model Context Protocol) was released as an early preview in Chrome 146 Canary on February 10, 2026. It is a W3C Draft Community Group Report developed by Google and Microsoft. It enables websites to expose tools to AI agents running inside Chrome via `navigator.modelContext.registerTool()` (imperative) or `toolname` HTML attributes (declarative).

WebMCP achieves 89% token efficiency improvement over screenshot-based methods and is a genuinely exciting standard.

## Options Considered

**Option A: Implement WebMCP in core now (behind a feature flag)**  
Allows early adopters to use it. Risk: the spec changes before stable, breaking our implementation.

**Option B: Implement WebMCP as a separate optional plugin now**  
Decouples the risk. Risk: adds maintenance overhead before the spec is stable.

**Option C: Exclude WebMCP entirely until Chrome stable ships**  
Zero risk. The tool registration use case is fully covered by `webagents.md` + AHP MODE3.

## Decision

**Option C: Exclude WebMCP from scope** until Chrome stable ships (expected mid-2026).

## Rationale

1. **Chrome-only**: WebMCP only works for AI agents running inside Chrome. The majority of agent traffic today comes from non-browser agents: CLI tools (Claude Code, Cursor), API agents, Playwright-driven headless browsers, and server-to-server agents. None of these benefit from WebMCP.

2. **Unstable spec**: The W3C Draft Community Group Report is not a final standard. It may change before the stable Chrome release. Building on an unstable spec risks breaking changes before our first stable release.

3. **Already covered**: The `webagents.md` specification (used by browser-use and other Playwright-based frameworks) covers the in-browser tool registration use case for all headless browsers, not just Chrome. AHP MODE3 covers the server-side async task delegation use case.

4. **Future path**: A separate `@agentfriendly/webmcp` plugin can be built after Chrome stable ships. Its interface will be additive and will not require changes to existing configurations.

## Consequences

- WebMCP-specific Chrome agent integrations are not supported until mid-2026+
- `webagents.md` is the supported in-browser tool discovery mechanism
- AHP MODE3 is the supported server-side tool/task delegation mechanism
- Site owners wanting early WebMCP access must implement it manually alongside this SDK
