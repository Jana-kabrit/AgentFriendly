# ADR-004: SQLite as Default Analytics Storage

**Status**: Accepted  
**Date**: March 2026

## Context

The analytics and audit log layers need to persist data. The choice of storage affects the setup complexity for new users and the capabilities for production users.

## Options Considered

**Option A: External SaaS (e.g., PostHog, Mixpanel, Amplitude)**  
Requires account creation, API key management, and an external network dependency on every request. Eliminates self-hosting.

**Option B: In-memory only**  
Zero setup. Data is lost on restart. Useless for any production analytics.

**Option C: SQLite (default) with optional Postgres/ClickHouse connectors**  
SQLite has zero setup — it is a single file. Works out of the box. For production, swap to Postgres or ClickHouse by changing one config line.

**Option D: Postgres as default**  
Requires a running Postgres instance. Most new users do not have one immediately available during local development.

## Decision

**Option C: SQLite as default, Postgres and ClickHouse as supported connectors.**

## Rationale

- SQLite requires zero infrastructure — it is a file on disk. A developer can get analytics working in under 60 seconds.
- For Cloudflare Workers (edge runtime), SQLite is unavailable. The Hono adapter uses Cloudflare D1 instead (D1 is SQLite-compatible but edge-native).
- Production workloads with high write volumes should use Postgres (via `better-pg`) or ClickHouse (via `@clickhouse/client`). Switching is a one-line config change: `analytics: { storage: "postgres", connectionString: process.env.DATABASE_URL }`.
- The storage layer is behind an interface (`AnalyticsAdapter`). Community-contributed adapters for MySQL, MongoDB, or other stores are possible without SDK changes.
- No external SaaS is ever required. Privacy-sensitive site owners can keep all analytics data on their own infrastructure.

## Consequences

- The SQLite adapter has a production throughput limit. Documentation must clearly state that SQLite is for development and low-traffic sites; Postgres or ClickHouse is recommended for production.
- The Hono/Cloudflare Workers adapter cannot use SQLite — it uses D1. This is documented in the Hono adapter README.
- The `better-sqlite3` peer dependency is optional (not required for Hono or Postgres-only setups).
