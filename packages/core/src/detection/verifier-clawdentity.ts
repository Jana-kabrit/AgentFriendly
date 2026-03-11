import { jwtVerify, createRemoteJWKSet, type JWTVerifyResult } from "jose";

import type { VerifiedIdentity } from "../types/agent-context.js";

/**
 * Clawdentity Agent Identity Token (AIT) Verifier
 *
 * Clawdentity is an IETF Internet-Draft (Feb 2026) that defines per-agent
 * cryptographic identities. A registry issues JWTs (Agent Identity Tokens)
 * that attest to an agent's identity, operator, and permission scopes.
 *
 * Agents present their AIT in the Authorization header:
 *   Authorization: AgentToken <jwt>
 *
 * The JWT contains:
 *   - iss: the Clawdentity registry URL
 *   - sub: the agent DID (e.g., "did:clawdentity:agent:anthropic:claude-code")
 *   - agent_id: human-readable agent name
 *   - operator: operator name
 *   - operator_url: operator website
 *   - capabilities: what the agent can do
 *   - scopes: permissions granted for this token
 *   - exp: expiry timestamp
 *
 * The JWT is signed by the Clawdentity registry's Ed25519 key, available
 * at the registry's JWKS endpoint.
 *
 * References:
 * - Draft: draft-ravikiran-clawdentity-protocol-00 (Feb 2026)
 * - GitHub: github.com/vrknetha/clawdentity
 */

/** The default Clawdentity registry URL. Configurable for private registries. */
const DEFAULT_REGISTRY_URL = "https://registry.clawdentity.org";

/**
 * Expected JWT claim shape for a Clawdentity AIT.
 * The `jose` library returns claims as `Record<string, unknown>`, so we
 * validate the shape ourselves rather than relying on type safety.
 */
interface AitClaims {
  iss?: string;
  sub?: string;
  exp?: number;
  agent_id?: string;
  operator?: string;
  operator_url?: string;
  capabilities?: string[];
  scopes?: string[];
}

/**
 * Cached JWKS sets by registry URL.
 * `createRemoteJWKSet` from `jose` handles JWKS caching and rotation internally.
 */
const jwkSets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwkSet(registryUrl: string): ReturnType<typeof createRemoteJWKSet> {
  const existing = jwkSets.get(registryUrl);
  if (existing) return existing;

  const jwksUrl = new URL("/.well-known/jwks.json", registryUrl);
  const jwkSet = createRemoteJWKSet(jwksUrl);
  jwkSets.set(registryUrl, jwkSet);
  return jwkSet;
}

/** Result of Clawdentity AIT verification. */
export interface ClawdentityVerificationResult {
  readonly valid: boolean;
  readonly identity: VerifiedIdentity | null;
  readonly errorReason: string | null;
}

/**
 * Verify a Clawdentity Agent Identity Token from the Authorization header.
 * Expects `Authorization: AgentToken <jwt>` format.
 */
export async function verifyClawdentityToken(
  authorizationHeader: string | undefined,
  registryUrl: string = DEFAULT_REGISTRY_URL,
): Promise<ClawdentityVerificationResult> {
  if (!authorizationHeader) {
    return { valid: false, identity: null, errorReason: "no-authorization-header" };
  }

  // Extract the token from "AgentToken <jwt>"
  const match = /^AgentToken\s+(.+)$/i.exec(authorizationHeader.trim());
  if (!match?.[1]) {
    return { valid: false, identity: null, errorReason: "not-agent-token-format" };
  }
  const token = match[1];

  // Verify the JWT signature against the registry's JWKS
  let verifyResult: JWTVerifyResult;
  try {
    const jwkSet = getJwkSet(registryUrl);
    verifyResult = await jwtVerify(token, jwkSet, {
      issuer: registryUrl,
      // Allow 60 seconds of clock skew
      clockTolerance: 60,
    });
  } catch (error) {
    return {
      valid: false,
      identity: null,
      errorReason: `jwt-verification-failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const claims = verifyResult.payload as AitClaims;

  // Validate required claims
  if (!claims.sub) {
    return { valid: false, identity: null, errorReason: "missing-sub-claim" };
  }
  if (!claims.operator) {
    return { valid: false, identity: null, errorReason: "missing-operator-claim" };
  }

  // Extract operator domain from operator_url
  let operatorDomain = claims.operator ?? "unknown";
  if (claims.operator_url) {
    try {
      operatorDomain = new URL(claims.operator_url).hostname;
    } catch {
      // fallback to raw operator string
    }
  }

  const identity: VerifiedIdentity = {
    method: "clawdentity",
    operatorDomain,
    agentId: claims.sub,
    scopes: claims.scopes ?? [],
    aitClaims: claims as Record<string, unknown>,
  };

  return { valid: true, identity, errorReason: null };
}
