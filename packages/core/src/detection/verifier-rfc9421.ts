import * as ed from "@noble/ed25519";

import type { VerifiedIdentity } from "../types/agent-context.js";

/**
 * RFC 9421 HTTP Message Signature Verifier
 *
 * Verifies Ed25519 HTTP Message Signatures as defined in RFC 9421.
 * Used by Cloudflare's Verified Bots Program (deployed to production, 2025).
 *
 * The verification flow:
 * 1. Parse `Signature-Input` header to get: component list, keyid URL, created timestamp
 * 2. Fetch the JWKS from `{keyid-domain}/.well-known/http-message-signatures-directory`
 *    (cached by key ID URL, TTL-based)
 * 3. Reconstruct the "signature base" — the deterministic string the agent signed
 * 4. Verify the Ed25519 signature from the `Signature` header against the public key
 * 5. Check that the `created` timestamp is within an acceptable skew window
 *
 * References:
 * - RFC 9421: https://www.rfc-editor.org/rfc/rfc9421
 * - JWKS format: https://www.rfc-editor.org/rfc/rfc7517
 */

/** Maximum age of a signature in seconds before it is considered expired. */
const MAX_SIGNATURE_AGE_SECONDS = 300; // 5 minutes

/** Maximum allowed clock skew between server and agent, in seconds. */
const MAX_CLOCK_SKEW_SECONDS = 60;

/** A cached JWKS public key entry. */
interface CachedKey {
  readonly publicKeyBytes: Uint8Array;
  readonly fetchedAt: number; // Unix timestamp in milliseconds
  readonly ttlMs: number;
}

/** In-memory key cache. Maps keyId URL → cached public key bytes. */
const keyCache = new Map<string, CachedKey>();

/** Default TTL for cached public keys: 1 hour. */
const DEFAULT_KEY_TTL_MS = 60 * 60 * 1000;

/** Clear a cache entry when it expires. */
function isCacheEntryValid(entry: CachedKey): boolean {
  return Date.now() - entry.fetchedAt < entry.ttlMs;
}

/**
 * Decode a Base64URL-encoded string to a Uint8Array.
 * RFC 9421 uses standard Base64 for the `Signature` value; JWKS uses Base64URL for the key.
 */
function decodeBase64Url(b64url: string): Uint8Array {
  // Normalize Base64URL to Base64
  const b64 = b64url
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(b64url.length + ((4 - (b64url.length % 4)) % 4), "=");
  const binary = atob(b64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/**
 * Decode a standard Base64-encoded string (used in Signature header).
 */
function decodeBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/**
 * Fetch and parse a JWKS from the agent's `.well-known` directory.
 * Extracts the first Ed25519 key (`kty: "OKP"`, `crv: "Ed25519"`).
 *
 * We use the global `fetch` (available in Node.js 18+, Cloudflare Workers, Deno).
 */
async function fetchPublicKey(
  keyId: string,
  ttlMs: number = DEFAULT_KEY_TTL_MS,
): Promise<Uint8Array> {
  // Check cache first
  const cached = keyCache.get(keyId);
  if (cached && isCacheEntryValid(cached)) {
    return cached.publicKeyBytes;
  }

  // Build the JWKS URL from the keyId.
  // The keyId is typically a URL like "https://agent.example.com/.well-known/agent-key/v1"
  // The JWKS directory is at "https://agent.example.com/.well-known/http-message-signatures-directory"
  const keyIdUrl = new URL(keyId);
  const jwksUrl = `${keyIdUrl.protocol}//${keyIdUrl.host}/.well-known/http-message-signatures-directory`;

  const response = await fetch(jwksUrl, {
    headers: { Accept: "application/json" },
    // 5-second timeout to prevent slow key fetches from blocking requests
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch JWKS from ${jwksUrl}: HTTP ${response.status}`);
  }

  const jwks = (await response.json()) as { keys?: unknown[] };
  if (!jwks.keys || !Array.isArray(jwks.keys)) {
    throw new Error(`Invalid JWKS at ${jwksUrl}: missing "keys" array`);
  }

  // Find the key matching the keyId, or fall back to the first Ed25519 key
  const key =
    (jwks.keys as Array<Record<string, unknown>>).find(
      (k) => k["kid"] === keyId && k["kty"] === "OKP" && k["crv"] === "Ed25519",
    ) ??
    (jwks.keys as Array<Record<string, unknown>>).find(
      (k) => k["kty"] === "OKP" && k["crv"] === "Ed25519",
    );

  if (!key || typeof key["x"] !== "string") {
    throw new Error(`No Ed25519 key found in JWKS at ${jwksUrl} for keyId "${keyId}"`);
  }

  const publicKeyBytes = decodeBase64Url(key["x"]);

  // Cache the key
  keyCache.set(keyId, {
    publicKeyBytes,
    fetchedAt: Date.now(),
    ttlMs,
  });

  return publicKeyBytes;
}

/**
 * Parse the `Signature-Input` header and extract:
 * - `keyid`: the key identifier URL
 * - `created`: Unix timestamp of signature creation
 * - `components`: list of message component names that were signed
 *
 * Example Signature-Input:
 *   sig1=("@method" "@target-uri" "content-type");keyid="https://a.co/key1";created=1709823456
 */
interface SignatureInputParsed {
  readonly signatureName: string;
  readonly components: string[];
  readonly keyId: string;
  readonly created: number;
}

export function parseSignatureInput(signatureInput: string): SignatureInputParsed | null {
  // Match: signame=("comp1" "comp2");keyid="...";created=timestamp
  const match = /^(\w+)=\(([^)]*)\);.*?keyid="([^"]+)".*?created=(\d+)/.exec(signatureInput);
  if (!match) return null;

  const [, signatureName, componentsStr, keyId, createdStr] = match;
  if (!signatureName || !componentsStr || !keyId || !createdStr) return null;

  const components = componentsStr
    .split(/\s+/)
    .map((c) => c.replace(/^"|"$/g, "").trim())
    .filter(Boolean);

  return {
    signatureName,
    components,
    keyId,
    created: Number(createdStr),
  };
}

/**
 * Build the "signature base" — the exact string that the agent signed.
 * This is deterministic: given the same request and component list, we must
 * produce the exact same string the agent produced before signing.
 *
 * Format per RFC 9421:
 * ```
 * "@method": GET
 * "@target-uri": https://example.com/api/data
 * "content-type": application/json
 * "@signature-params": ("@method" "@target-uri" "content-type");keyid="...";created=1234567890
 * ```
 */
export function buildSignatureBase(
  request: { method: string; url: string; headers: Record<string, string> },
  parsed: SignatureInputParsed,
  signatureInputRaw: string,
): string {
  const lines: string[] = [];

  for (const component of parsed.components) {
    switch (component) {
      case "@method":
        lines.push(`"@method": ${request.method.toUpperCase()}`);
        break;
      case "@target-uri":
        lines.push(`"@target-uri": ${request.url}`);
        break;
      case "@path": {
        const url = new URL(request.url);
        lines.push(`"@path": ${url.pathname}`);
        break;
      }
      case "@query": {
        const url = new URL(request.url);
        lines.push(`"@query": ?${url.search.slice(1)}`);
        break;
      }
      case "@authority": {
        const url = new URL(request.url);
        lines.push(`"@authority": ${url.host}`);
        break;
      }
      default: {
        // Regular header: look it up in request headers (lowercase key)
        const headerValue = request.headers[component.toLowerCase()];
        if (headerValue !== undefined) {
          lines.push(`"${component}": ${headerValue}`);
        }
        break;
      }
    }
  }

  // Always add the @signature-params line last
  lines.push(`"@signature-params": ${signatureInputRaw}`);

  return lines.join("\n");
}

/**
 * Extract the Base64-encoded signature value from the `Signature` header.
 * Example: sig1=:Base64EncodedSignature:
 */
function extractSignatureValue(signatureHeader: string, signatureName: string): string | null {
  const match = new RegExp(`${signatureName}=:(.*?):`).exec(signatureHeader);
  return match?.[1] ?? null;
}

/** Result of RFC 9421 verification. */
export interface Rfc9421VerificationResult {
  readonly valid: boolean;
  readonly identity: VerifiedIdentity | null;
  readonly errorReason: string | null;
}

/**
 * Verify an RFC 9421 HTTP Message Signature on an incoming request.
 *
 * Returns a VerifiedIdentity if verification succeeds, or null + an error reason if not.
 * This is called once per request; the result is cached in AgentContext.
 */
export async function verifyRfc9421Signature(
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
  },
  keyTtlMs?: number,
): Promise<Rfc9421VerificationResult> {
  const signatureHeader = request.headers["signature"];
  const signatureInputHeader = request.headers["signature-input"];

  if (!signatureHeader || !signatureInputHeader) {
    return { valid: false, identity: null, errorReason: "no-signature-headers" };
  }

  // Parse Signature-Input
  const parsed = parseSignatureInput(signatureInputHeader);
  if (!parsed) {
    return {
      valid: false,
      identity: null,
      errorReason: "invalid-signature-input-format",
    };
  }

  // Check timestamp freshness
  const nowSeconds = Math.floor(Date.now() / 1000);
  const ageSeconds = nowSeconds - parsed.created;
  if (ageSeconds > MAX_SIGNATURE_AGE_SECONDS) {
    return { valid: false, identity: null, errorReason: "signature-expired" };
  }
  if (ageSeconds < -MAX_CLOCK_SKEW_SECONDS) {
    return { valid: false, identity: null, errorReason: "signature-from-future" };
  }

  // Extract the signature value
  const signatureValue = extractSignatureValue(signatureHeader, parsed.signatureName);
  if (!signatureValue) {
    return { valid: false, identity: null, errorReason: "signature-value-not-found" };
  }

  // Fetch the public key
  let publicKeyBytes: Uint8Array;
  try {
    publicKeyBytes = await fetchPublicKey(parsed.keyId, keyTtlMs);
  } catch (error) {
    return {
      valid: false,
      identity: null,
      errorReason: `key-fetch-failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // Reconstruct the signature base
  const signatureBase = buildSignatureBase(request, parsed, signatureInputHeader);
  const messageBytes = new TextEncoder().encode(signatureBase);

  // Decode the signature
  let signatureBytes: Uint8Array;
  try {
    signatureBytes = decodeBase64(signatureValue);
  } catch {
    return { valid: false, identity: null, errorReason: "invalid-signature-encoding" };
  }

  // Verify with Ed25519
  let valid: boolean;
  try {
    valid = await ed.verify(signatureBytes, messageBytes, publicKeyBytes);
  } catch {
    return { valid: false, identity: null, errorReason: "signature-verification-error" };
  }

  if (!valid) {
    return { valid: false, identity: null, errorReason: "signature-invalid" };
  }

  // Extract the operator domain from the keyId URL
  let operatorDomain: string;
  try {
    operatorDomain = new URL(parsed.keyId).hostname;
  } catch {
    operatorDomain = parsed.keyId;
  }

  const identity: VerifiedIdentity = {
    method: "rfc9421",
    operatorDomain,
    agentId: parsed.keyId,
    scopes: [],
  };

  return { valid: true, identity, errorReason: null };
}

/**
 * Clear the public key cache. Only needed in tests.
 * @internal
 */
export function _clearKeyCache(): void {
  keyCache.clear();
}
