# Debug Mode

Debug mode exposes the internals of the SDK pipeline via HTTP headers and a dedicated endpoint. It is intended for local development and integration testing only — never enable it in production.

## Enabling Debug Mode

```typescript
const sdk = createAgentFriendlyMiddleware({
  debug: true,
  // ... rest of config
});
```

---

## Debug Headers

When `debug: true`, every agent response (not just discovery files) includes `X-AgentFriendly-*` headers:

| Header | Example Value | Meaning |
|--------|--------------|---------|
| `X-AgentFriendly-Tier` | `known-agent` | The resolved TrustTier |
| `X-AgentFriendly-Signals` | `ua-database,accept-header` | Comma-separated DetectionSignals that fired |
| `X-AgentFriendly-Operator` | `openai` | Detected agent operator |
| `X-AgentFriendly-Type` | `crawler` | Detected agent type |
| `X-AgentFriendly-RequestId` | `a1b2c3d4-...` | UUID for this request (correlate with logs) |
| `X-AgentFriendly-ConvertMd` | `true` | Whether HTML→Markdown conversion was applied |
| `X-AgentFriendly-TokenCount` | `742` | Estimated tokens in markdown response |

These headers are stripped from production responses (when `debug: false`).

---

## `/agent-debug` Endpoint

A special discovery route that returns a full JSON dump of the `AgentContext` and pipeline timing:

```http
GET /agent-debug
Accept: application/json
User-Agent: GPTBot/1.0
```

```json
{
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2024-03-07T12:00:00.000Z",
  "tier": "known-agent",
  "signals": ["ua-database"],
  "userAgent": "GPTBot/1.0",
  "agentOperator": "openai",
  "agentType": "crawler",
  "verifiedIdentity": null,
  "tenantContext": null,
  "pipeline": {
    "detectionMs": 0.82,
    "multitennancyMs": 0.01,
    "discoveryMs": 0.05,
    "accessMs": 0.15,
    "monetizationMs": 0.02,
    "contentMs": 0.21
  },
  "contentInstructions": {
    "convertToMarkdown": true,
    "agentHeaders": {
      "content-signal": "ai-training=disallowed; ai-inference=allowed",
      "x-markdown-tokens": "742"
    }
  }
}
```

This endpoint is only available when `debug: true`. In production (debug: false), it returns `404`.

---

## Using Debug Mode in Development

### 1. Testing detection signals

```bash
# Test that your UA database recognizes a known agent
curl -H "User-Agent: GPTBot/1.0" http://localhost:3000/agent-debug | jq .tier

# Expected: "known-agent"
```

### 2. Testing markdown serving

```bash
# Verify markdown is served for known agents
curl -H "User-Agent: GPTBot/1.0" http://localhost:3000/blog/my-post \
  -v 2>&1 | grep "content-type"

# Expected: content-type: text/markdown; charset=utf-8
```

### 3. Testing access control

```bash
# Verify admin routes are blocked for known agents
curl -H "User-Agent: GPTBot/1.0" http://localhost:3000/admin/ -v 2>&1 | grep "HTTP/"

# Expected: HTTP/1.1 403 Forbidden
```

### 4. CLI integration

The `agentfriendly test-detection` and `agentfriendly preview` CLI commands automatically use the `/agent-debug` endpoint and debug headers when testing against a local server.

---

## Security Warning

`debug: true` exposes:
- Internal trust tier decisions (could be used to craft evasion payloads).
- Full pipeline timing (could inform denial-of-service targeting of slow steps).
- Tenant context claims (could leak user ID structure).

Always use environment variable gating:

```typescript
debug: process.env.NODE_ENV === "development",
```
