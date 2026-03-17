# Agent Identity Verification

## The Problem

User-Agent headers are trivially spoofable. Any HTTP client can send:

```
User-Agent: ClaudeBot/1.0
```

And your server has no way to verify this is actually Anthropic's Claude.

This matters because:

- Malicious scrapers can spoof legitimate agent UAs to bypass access controls
- `verified-only` routes that should only serve Claude cannot distinguish real Claude from a scraper claiming to be Claude
- Monetization policies applied to specific agent types can be bypassed
- Audit logs become unreliable

The solution is **cryptographic identity verification** — the agent signs its requests with a private key, and your server verifies the signature against the agent's published public key.

---

## RFC 9421 — HTTP Message Signatures (The Primary Standard)

**Status**: IETF RFC (finalized standard)  
**Deployed in production**: Cloudflare Verified Bots Program (2025)

### How It Works

**Agent side (one-time setup)**:

1. Generate an Ed25519 keypair
2. Host the public key as a JWKS (JSON Web Key Set) at `/.well-known/http-message-signatures-directory` on the agent operator's domain

**Agent side (per-request)**: 3. Select the message components to sign (typically: method, path, `Content-Type`, `Digest`, timestamp) 4. Compute the "signature base" (a deterministic string from the selected components) 5. Sign with the Ed25519 private key 6. Add two headers to the request:

- `Signature-Input: sig1=("@method" "@target-uri" "content-type");keyid="https://agent-operator.com/key1";created=1709823456`
- `Signature: sig1=:Base64EncodedSignature:`

**Server side (per-request)**: 7. Check for `Signature` and `Signature-Input` headers 8. Parse `Signature-Input` to extract: component names, `keyid`, and `created` timestamp 9. Fetch the JWKS from `https://<keyid-domain>/.well-known/http-message-signatures-directory`
(cached with configurable TTL — typically 1 hour) 10. Find the matching public key by key ID 11. Reconstruct the signature base from the request components listed in `Signature-Input` 12. Verify the Ed25519 signature

If verification passes: trust tier is `verified-agent`. If it fails or no signature headers are present: fall back to UA database classification.

### The JWKS Directory Format

```json
{
  "keys": [
    {
      "kty": "OKP",
      "crv": "Ed25519",
      "kid": "https://agent-operator.com/key1",
      "x": "Base64UrlEncodedPublicKey",
      "use": "sig"
    }
  ]
}
```

### Verifying a Request (TypeScript Example)

```typescript
import * as ed from "@noble/ed25519";

async function verifyAgentSignature(request: Request, publicKeyBase64: string): Promise<boolean> {
  const signatureHeader = request.headers.get("Signature");
  const signatureInputHeader = request.headers.get("Signature-Input");

  if (!signatureHeader || !signatureInputHeader) return false;

  const signatureBase = buildSignatureBase(request, signatureInputHeader);
  const signatureBytes = base64Decode(signatureHeader.replace("sig1=:", "").replace(":", ""));
  const publicKeyBytes = base64UrlDecode(publicKeyBase64);

  return ed.verify(signatureBytes, new TextEncoder().encode(signatureBase), publicKeyBytes);
}
```

---

## Clawdentity — Registry-Issued Agent Identity Tokens

**Status**: IETF Internet-Draft (draft-ravikiran-clawdentity-protocol-00, Feb 2026)  
**GitHub**: [github.com/vrknetha/clawdentity](https://github.com/vrknetha/clawdentity)

### How It Differs from RFC 9421

RFC 9421 is self-asserted: the agent operator creates a keypair and hosts it themselves. Anyone can do this — it proves the request was signed by someone with that key, but does not prove who the key owner actually is.

Clawdentity adds a **registry layer**: a trusted registry issues Agent Identity Tokens (AITs) that attest to the agent's identity. The registry verifies the operator, then issues a JWT containing:

```json
{
  "iss": "https://registry.clawdentity.org",
  "sub": "did:clawdentity:agent:operator-name:agent-name",
  "agent_id": "claude-code",
  "operator": "Anthropic PBC",
  "operator_url": "https://www.anthropic.com",
  "capabilities": ["web-fetch", "code-execution"],
  "scopes": ["read:public"],
  "exp": 1709823456
}
```

The agent presents this token in `Authorization: AgentToken <jwt>`.

The server:

1. Extracts the JWT
2. Verifies the JWT signature against Clawdentity's public key (published at the registry)
3. Checks the `exp` claim (not expired)
4. Reads `operator`, `agent_id`, `scopes` from the verified claims

This is more trustworthy than RFC 9421 self-assertion because the registry vouches for the operator's identity. But it requires registry participation — an agent operator must apply to Clawdentity to get an AIT issued.

---

## WIMSE HTTP Signatures — Workload Identity Tokens

**Status**: IETF Internet-Draft (draft-ietf-wimse-http-signature-02, March 5 2026)

WIMSE (Workload Identity in Multi-System Environments) extends RFC 9421 with **Workload Identity Tokens (WIT)** — short-lived JWTs issued by a workload identity provider (like SPIRE, AWS IAM, or Google Cloud Workload Identity).

The key addition: WITs provide end-to-end protection even through TLS proxies and load balancers that terminate TLS. Traditional mTLS breaks at the first proxy; WIMSE signatures survive it.

For the purposes of `@agentfriendly`, WIMSE adds a layer for enterprise agents operating in complex cloud environments. The SDK supports WIMSE signatures with the same verification flow as RFC 9421.

---

## Agent Identity Protocol (AIP)

**Status**: Open-source specification  
**GitHub**: [github.com/openagentidentityprotocol/agentidentityprotocol](https://github.com/openagentidentityprotocol/agentidentityprotocol)

AIP addresses the "God Mode Problem": agents currently receive full API key access, indistinguishable from human users. AIP proposes a two-layer model:

**Layer 1 — Identity**: Each agent has a unique certificate-based identity (similar to TLS certificates). This is the "who are you" layer.

**Layer 2 — Authorization**: Policy-based authorization at the tool-call layer. This is the "what can you do" layer. The policy engine evaluates the agent's identity, the requested tool, and configured permissions before allowing the call.

AIP is more ambitious than RFC 9421 or Clawdentity — it aims to be a complete agent identity infrastructure, not just request signing. It is still early-stage.

---

## How `@agentfriendly` Implements Verification

Layer 0 of the SDK includes the full verification pipeline:

1. Check for `Signature` + `Signature-Input` headers → RFC 9421 verification
2. Check for `Authorization: AgentToken <jwt>` → Clawdentity AIT verification
3. If either passes → trust tier becomes `verified-agent`
4. The verified `agent_id` and `operator` are stored in `AgentContext` for use by all downstream layers

Routes marked `verified-only` in the access config return HTTP 401 with `WWW-Authenticate: AgentSignature` for requests that do not pass verification. The challenge header includes a link to the verification documentation.

```typescript
// agentfriendly.config.ts
export default {
  identity: {
    requireVerification: ["/api/premium/**", "/admin/agent/**"],
    clawdentityRegistry: "https://registry.clawdentity.org",
    keyCache: {
      ttlSeconds: 3600, // Cache public keys for 1 hour
      maxEntries: 1000,
    },
  },
};
```
