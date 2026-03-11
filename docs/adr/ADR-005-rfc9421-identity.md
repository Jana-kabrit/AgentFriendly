# ADR-005: RFC 9421 HTTP Message Signatures for Agent Identity Verification

**Status**: Accepted  
**Date**: March 2026

## Context

Any bot can spoof a `User-Agent` header. The UA database approach (Layer 0, Layer 2 detection) classifies agents by their claimed identity but cannot verify it. A malicious scraper can claim to be Claude Code, bypass access controls, and avoid monetization.

## Options Considered

**Option A: IP allowlists**  
Brittle. IP ranges change. Load balancers and cloud NAT hide true origins. Cloudflare's own blog explicitly recommended against this in January 2026.

**Option B: API keys / Bearer tokens**  
Requires agent operators to register with each site owner. Creates a per-site onboarding burden. Does not scale to the open web.

**Option C: Mutual TLS (mTLS)**  
Strong cryptographic identity. Requires configuring TLS at the server level, which is infrastructure-dependent and complex to implement in middleware.

**Option D: RFC 9421 HTTP Message Signatures (Ed25519)**  
Standard IETF spec. Bot generates an Ed25519 keypair, hosts the public key at `/.well-known/http-message-signatures-directory` (JWKS format), and signs all HTTP requests with `Signature` and `Signature-Input` headers. Server fetches the public key (cached), verifies the signature cryptographically. Already deployed in production by Cloudflare's Verified Bots Program.

**Option E: Clawdentity AIT tokens**  
IETF Internet-Draft (Feb 2026). Registry-issued JWT tokens containing agent DID and permissions. More powerful (registry provides provenance), less deployed (new draft).

## Decision

**Option D (RFC 9421) as the primary verification mechanism, with Option E (Clawdentity AIT) as a secondary supported format.**

## Rationale

- RFC 9421 is an IETF-standardized specification already deployed by Cloudflare in production. It is not experimental.
- The public key is self-hosted by the agent operator — no central registry required. This works on the open web without permissioning.
- Ed25519 verification is extremely fast (sub-millisecond), adding negligible latency per request.
- Key caching (TTL-based, configurable) means the JWKS fetch happens once per key rotation, not once per request.
- Clawdentity provides registry-issued provenance (an agent's DID is attested by a registry, not just self-asserted). This is more trustworthy but requires registry participation. Supporting both covers agents in both ecosystems.

## Implementation

- `Signature` + `Signature-Input` headers detected → fetch JWKS from `https://<keyid-domain>/.well-known/http-message-signatures-directory` → verify Ed25519 signature using `@noble/ed25519` → upgrade trust tier to `verified-agent`
- `Authorization: AgentToken <jwt>` detected → verify JWT against Clawdentity registry → upgrade trust tier to `verified-agent`
- Routes marked `verified-only` return HTTP 401 with `WWW-Authenticate: AgentSignature realm="..."` for unverified requests

## Consequences

- Agent operators who want `verified-agent` trust tier must generate an Ed25519 keypair and host a JWKS directory. This is a one-time setup. Documentation provides a step-by-step guide.
- Verification adds a network round-trip on first encounter with a new agent domain. The public key is then cached for the configured TTL.
- Sites that do not require verification (no `verified-only` routes configured) incur no additional cost — the verifier only runs when relevant.
