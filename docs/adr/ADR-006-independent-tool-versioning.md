# ADR-006: Independent Tool API Versioning

**Status**: Accepted  
**Date**: March 2026

## Context

When a site owner exposes tools to agents via `agentMeta`, agents may learn to use those tools. If the tool's input schema changes in a backward-incompatible way, existing agents break. The question is how to version these tool contracts relative to the SDK's own package version.

## Options Considered

**Option A: Couple tool versions to SDK package versions**  
A breaking tool change requires bumping `@agentfriendly/core` to a new major version. This is incorrect granularity — the SDK itself has not changed.

**Option B: Tool versions are independent semver, old schemas remain accessible**  
Tools carry their own `version` field. Breaking changes increment the tool's semver major. Old schemas remain accessible at `/agent-tools/v{n}.json`. The SDK package version is unrelated.

## Decision

**Option B: Fully independent tool versioning.**

## Rationale

- Tool contracts are the API that agents depend on, not the SDK. An agent that has learned to call `searchProducts@1.0` with `{ query: string }` should continue working after `searchProducts@2.0` introduces `{ query: string, filters: object }` with an incompatible schema change.
- SDK breaking changes (changed config shape, removed exports) and tool API breaking changes have completely different causes, timelines, and audiences. Coupling them creates unnecessary coordination overhead.
- The pattern is established: REST APIs use URL path versioning (`/v1/`, `/v2/`). We use file path versioning for tool manifests (`/agent-tools/v1.json`, `/agent-tools/v2.json`).

## Implementation

- `agentMeta.version` field (optional, default `"1.0.0"`)
- `/agent-tools/v{major}.json` served for each major version of each tool's history
- `/.well-known/agent-tools.json` points to the latest version of all tools
- SDK logs a warning when a tool's input schema changes without a corresponding version bump in `agentMeta.version`
- Old tool handlers remain registered until explicitly removed by the site owner

## Consequences

- Site owners must increment `agentMeta.version` when making breaking changes to a tool's schema. The SDK warns but does not enforce this automatically (it cannot know if a schema change is breaking or additive).
- Old tool handler implementations must remain in the codebase until the site owner is confident no agents are still using the old version. The SDK provides analytics showing usage per tool version.
