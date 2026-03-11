import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { randomUUID } from "node:crypto";

import type { TenantContext } from "../types/agent-context.js";
import type { MultiTenancyConfig } from "../types/config.js";

/**
 * Layer 8 — RFC 8693 Token Exchange: Multi-Tenant Agent Session Management
 *
 * Implements the "agent acting on behalf of user" pattern using JWT-based
 * delegation tokens inspired by RFC 8693 (OAuth 2.0 Token Exchange).
 *
 * The flow:
 * 1. A user logs into a SaaS platform and wants to grant an agent access to
 *    their account (e.g., "allow Claude Code to manage my Jira tickets")
 * 2. The platform's "Agent Access" settings page shows a button: "Authorize Agent"
 * 3. The user clicks; the platform issues a delegation JWT (the "agent session token")
 *    containing: userId, tenantId, granted scopes, and expiry
 * 4. The user provides this token to the agent (or the agent fetches it via OAuth flow)
 * 5. The agent includes the token in all requests to the platform:
 *    `Authorization: Bearer <delegation-jwt>`  (or `X-Agent-Session: <token>`)
 * 6. The SDK's middleware validates the token, extracts the tenant context,
 *    and stores it in AgentContext.tenantContext
 * 7. All downstream layers (tools, PII masking, DB queries) are scoped to this tenant
 *
 * Security:
 * - Tokens are signed with HS256 (HMAC-SHA256) using the configured tokenSecret
 * - The tokenSecret must be at least 32 bytes of entropy
 * - Tokens expire after the configured sessionTtlSeconds (default: 1 hour)
 * - Revoked tokens are tracked in an in-memory CRL (Certificate Revocation List)
 *   which is checked on every request
 *
 * Reference: RFC 8693 defines the `act` claim in JWTs for delegation chains.
 * We use a simplified subset appropriate for SaaS platform-to-agent delegation.
 */

/** The JWT payload shape for an agent delegation token. */
interface DelegationTokenPayload extends JWTPayload {
  /** User ID on whose behalf the agent is acting. */
  uid: string;
  /** Tenant/organization ID within the SaaS platform. */
  tid: string;
  /** Stable session identifier for this delegation. */
  sid: string;
  /** Permission scopes granted to the agent for this user+tenant. */
  scopes: string[];
}

/** The in-memory Certificate Revocation List. Maps session ID → revocation reason. */
const revokedSessions = new Map<string, { reason: string; revokedAt: string }>();

/** Encode the token secret as a Uint8Array for jose. */
function encodeSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/**
 * Issue a new agent delegation token for a user+tenant combination.
 * Call this in your "Authorize Agent" endpoint when a user grants agent access.
 */
export async function issueDelegationToken(
  userId: string,
  tenantId: string,
  grantedScopes: string[],
  config: MultiTenancyConfig,
): Promise<{ token: string; sessionId: string; expiresAt: string }> {
  if (!config.tokenSecret) {
    throw new Error(
      "[@agentfriendly/multitenancy] config.multiTenancy.tokenSecret is required to issue delegation tokens",
    );
  }

  const sessionId = randomUUID();
  const ttlSeconds = config.sessionTtlSeconds ?? 3600;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  const token = await new SignJWT({
    uid: userId,
    tid: tenantId,
    sid: sessionId,
    scopes: grantedScopes,
  } satisfies Omit<DelegationTokenPayload, keyof JWTPayload>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .setJti(sessionId)
    .sign(encodeSecret(config.tokenSecret));

  return { token, sessionId, expiresAt };
}

/** Result of validating a delegation token. */
export interface TokenValidationResult {
  readonly valid: boolean;
  readonly tenantContext: TenantContext | null;
  readonly errorReason: string | null;
}

/**
 * Validate an agent delegation token and extract the tenant context.
 * Returns a TenantContext if valid, or an error reason if not.
 */
export async function validateDelegationToken(
  tokenHeader: string | undefined,
  config: MultiTenancyConfig,
): Promise<TokenValidationResult> {
  if (!config.enabled) {
    return { valid: false, tenantContext: null, errorReason: "multi-tenancy-disabled" };
  }
  if (!tokenHeader || !config.tokenSecret) {
    return { valid: false, tenantContext: null, errorReason: "no-token-or-secret" };
  }

  // Support both "Bearer <token>" and "AgentSession <token>" header formats
  const rawToken = tokenHeader.replace(/^(bearer|agentsession)\s+/i, "").trim();
  if (!rawToken) {
    return { valid: false, tenantContext: null, errorReason: "empty-token" };
  }

  let payload: DelegationTokenPayload;
  try {
    const result = await jwtVerify(rawToken, encodeSecret(config.tokenSecret), {
      clockTolerance: 30,
    });
    payload = result.payload as DelegationTokenPayload;
  } catch (error) {
    return {
      valid: false,
      tenantContext: null,
      errorReason: `jwt-invalid: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // Check the CRL
  if (payload.sid && revokedSessions.has(payload.sid)) {
    return { valid: false, tenantContext: null, errorReason: "session-revoked" };
  }

  if (!payload.uid || !payload.tid || !payload.sid) {
    return { valid: false, tenantContext: null, errorReason: "missing-required-claims" };
  }

  const tenantContext: TenantContext = {
    userId: payload.uid,
    tenantId: payload.tid,
    sessionId: payload.sid,
    grantedScopes: payload.scopes ?? [],
    expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : new Date().toISOString(),
  };

  return { valid: true, tenantContext, errorReason: null };
}

/**
 * Revoke an agent session by its session ID.
 * Revoked sessions are rejected on all subsequent requests.
 * The CRL is in-memory — it is cleared on server restart.
 * For persistent revocation, persist the CRL to your database.
 */
export function revokeSession(sessionId: string, reason: string = "manual-revocation"): void {
  revokedSessions.set(sessionId, { reason, revokedAt: new Date().toISOString() });
}

/**
 * Check if a session is revoked.
 */
export function isSessionRevoked(sessionId: string): boolean {
  return revokedSessions.has(sessionId);
}

/**
 * Get the full CRL. Used for persistence (serialize and reload on startup).
 */
export function getCrl(): ReadonlyMap<string, { reason: string; revokedAt: string }> {
  return revokedSessions;
}

/**
 * Load a previously persisted CRL. Call on startup if you persist revocations to a DB.
 */
export function loadCrl(entries: Array<{ sessionId: string; reason: string; revokedAt: string }>): void {
  for (const entry of entries) {
    revokedSessions.set(entry.sessionId, { reason: entry.reason, revokedAt: entry.revokedAt });
  }
}
