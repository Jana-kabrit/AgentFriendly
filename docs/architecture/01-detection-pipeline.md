# Layer 0: Detection Pipeline

The detection pipeline is the entry point for every request. It runs before any other processing and determines the `TrustTier` of the incoming request — which drives every subsequent decision in the stack.

## Trust Tier Model

```
"human"           → No agent processing. Skip all layers.
"suspected-agent" → Heuristic signals. Optional markdown, limited access.
"known-agent"     → Confirmed via UA database or strong headers.
"verified-agent"  → Cryptographically authenticated identity.
```

Tiers are strictly ordered. A request can only move up the chain (more trusted), never down. The highest tier confirmed by any signal wins.

## The Four Signals

Signals run in priority order. Each populates a `DetectionSignal[]` on the resulting `TierResolution`. The final tier is the maximum across all signals.

### Signal 1: Accept Header (`signal-accept-header.ts`)

**Speed**: < 0.1ms  
**Reliability**: Medium

Parses the `Accept` HTTP header for agent-specific MIME types.

| MIME type | Indicates |
|-----------|-----------|
| `text/markdown` | Agent is capable of consuming markdown; may be a browser extension or an LLM-driven agent |
| `application/agent+json` (explicit) | Agent explicitly identifies as an AI agent using the AHP standard |

Wildcard `*/*` entries never trigger a positive signal — only explicit mentions.

**What it produces:**
- `prefersMarkdown: boolean`
- `prefersAgentJson: boolean`

If either is `true`, the tier is raised to at minimum `"suspected-agent"`. If `prefersAgentJson` is `true`, the tier is raised to `"known-agent"` (the agent is explicitly self-identifying).

```typescript
// Positive example: agent explicitly accepts agent+json
Accept: application/agent+json, text/html;q=0.9

// Positive example: agent prefers markdown
Accept: text/markdown, */*;q=0.8

// Negative: wildcard only, not an agent signal
Accept: */*
```

---

### Signal 2: UA Database (`signal-ua-database.ts`)

**Speed**: < 1ms (in-memory hash lookup)  
**Reliability**: High for known agents

Loads `@agentfriendly/ua-database/data/agents.json` and performs normalized prefix matching against the User-Agent string.

The database stores entries as:
```json
{
  "prefix": "gptbot",
  "tier": "known-agent",
  "operator": "openai",
  "type": "crawler"
}
```

Matching is case-insensitive and uses prefix matching (not full string equality), accommodating versioned UA strings like `GPTBot/1.2`.

If matched, the tier is set to at least `"known-agent"`, and `agentOperator` and `agentType` are populated on the `AgentContext`.

---

### Signal 3: HTTP Header Heuristics (`signal-header-heuristics.ts`)

**Speed**: < 0.2ms  
**Reliability**: Medium (false positives possible)

Analyzes the presence or absence of typical browser vs. agent patterns in request headers.

| Check | Description |
|-------|-------------|
| Missing `Accept-Language` | Browsers always send this; agents frequently omit it |
| Missing `Cookie` on stateful routes | Real user sessions usually have session cookies |
| Missing `Sec-Fetch-*` headers | Fetch Metadata headers are browser-specific (added by Blink/WebKit) |
| Minimal `Accept` header | Browsers send 5+ MIME types; minimal accept headers suggest non-browser |
| `Authorization` header present | Suggests API-style call pattern |
| `X-Agent-*` custom headers | Many agent frameworks inject these |
| UA string starts with known script patterns | e.g., `python-requests`, `axios`, `curl/` |

A score of 2 or more suspicious patterns raises the tier to `"suspected-agent"`. This is conservative by design to avoid false positives on API clients.

---

### Signal 4: Identity Verifiers

These run only if `detection.enableVerification` is `true` in the SDK config.

#### RFC 9421 HTTP Message Signatures (`verifier-rfc9421.ts`)

**Speed**: 5–50ms (requires key fetch on first request)  
**Reliability**: Very high (cryptographic)

Validates `Signature` and `Signature-Input` headers according to [RFC 9421](https://www.rfc-editor.org/rfc/rfc9421). The public key is fetched from `https://{operator-domain}/.well-known/agent-keys/{keyId}` on first use and cached in-memory.

Uses Ed25519 signature verification via the Web Crypto API.

If valid, the tier becomes `"verified-agent"` and `verifiedIdentity` is set on `AgentContext`:
```typescript
verifiedIdentity: {
  agentId: "gptbot-prod-1",
  operator: "openai.com",
  keyId: "openai-2024-01",
  verifiedAt: Date,
}
```

#### Clawdentity AIT (`verifier-clawdentity.ts`)

**Speed**: 5–20ms (JWT verification, no network)  
**Reliability**: Very high (cryptographic)

Validates Agent Identity Tokens (AITs) — JWTs signed by the agent's operator — carried in the `X-Agent-Identity-Token` header. Uses `jose` for JWT verification.

Expected claims:
```json
{
  "sub": "agent-id",
  "iss": "https://openai.com",
  "aud": "https://yoursite.com",
  "agentType": "assistant",
  "operator": "openai",
  "iat": 1700000000,
  "exp": 1700003600
}
```

If valid, the tier becomes `"verified-agent"`.

---

## Pipeline Composition (`pipeline.ts`)

The pipeline runs all four signals concurrently (where safe) and merges results:

```typescript
export async function runDetectionPipeline(
  request: AgentRequest,
  config: DetectionConfig,
): Promise<AgentContext>
```

Resolution logic:
1. Run Accept header and Header Heuristics synchronously.
2. Run UA Database lookup.
3. If `enableVerification`, run identity verifiers.
4. `finalTier = max(tier from each signal)`.
5. Freeze and return `AgentContext`.

**Short-circuit**: If a `"verified-agent"` identity is confirmed, the UA database and heuristic results are still recorded in `signals[]` for analytics, but no further verification is attempted.

---

## AgentContext Shape

```typescript
interface AgentContext {
  readonly requestId: string;      // UUID generated per request
  readonly timestamp: Date;
  readonly tier: TrustTier;
  readonly signals: DetectionSignal[];
  readonly userAgent: string | null;
  readonly agentOperator: string | null;   // e.g. "openai"
  readonly agentType: string | null;       // e.g. "crawler" | "assistant"
  readonly verifiedIdentity: VerifiedIdentity | null;
  readonly tenantContext: TenantContext | null;  // populated by Layer 8
}
```

---

## Configuration

```typescript
detection: {
  enableVerification: boolean;  // default: false — enables RFC 9421 + AIT
  trustedOperators: string[];   // allow-list of operator domains
}
```

---

## Performance Characteristics

| Scenario | Typical latency |
|----------|----------------|
| Human request (all signals = negative) | < 1ms |
| Known bot (UA database hit) | < 1ms |
| Suspected agent (heuristics) | < 1ms |
| RFC 9421 verification (cache hit) | < 5ms |
| RFC 9421 verification (first request, key fetch) | 20–80ms |
| Clawdentity AIT (JWT verify) | < 5ms |
