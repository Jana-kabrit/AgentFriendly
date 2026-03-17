# Layer 8: Multi-Tenancy

Multi-tenancy enables agents to act on behalf of specific users within a SaaS platform. Without this layer, an agent accessing a SaaS has platform-level access — it cannot be restricted to one user's data or scoped to specific operations.

## The Problem

Consider a SaaS like a project management tool. A user wants their AI assistant to "create a task in my account." The agent needs to:

1. Authenticate as the _user's agent_, not as a generic API client.
2. Access only that user's projects, not all projects on the platform.
3. Reveal only the user's PII (their own email, etc.), not other users'.
4. Be restricted to the operations the user has consented to.

Standard API keys and OAuth flows don't map cleanly to autonomous agent sessions. The multi-tenancy layer solves this with **RFC 8693-inspired delegation tokens**.

---

## Delegation Token Flow

```
1. User authenticates with your app normally (login, OAuth, etc.)

2. Your app calls issueDelegationToken() and gives the agent the token:

   const token = await issueDelegationToken(
     userId,           // "user_abc123"
     tenantId,         // "org_xyz789"
     ["read:profile", "write:tasks", "reveal:email"],
     config.multitenancy
   );
   // → "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

3. Agent includes the token on every request:
   X-Agent-Session: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

4. SDK validates the token and injects TenantContext:
   context.tenantContext = {
     userId: "user_abc123",
     tenantId: "org_xyz789",
     scopes: ["read:profile", "write:tasks", "reveal:email"]
   }

5. Your route handlers and tools use context.tenantContext to
   scope database queries and decisions.
```

---

## JWT Token Structure

The delegation token is a signed JWT:

```json
{
  "sub": "agent-session",
  "iss": "https://yourapp.com",
  "aud": "https://yourapp.com",
  "act": {
    "sub": "user_abc123",
    "tenantId": "org_xyz789"
  },
  "scope": "read:profile write:tasks reveal:email",
  "iat": 1700000000,
  "exp": 1700086400
}
```

The `act` claim follows RFC 8693 token exchange semantics — indicating that the token is issued to act _on behalf of_ the user, not as the user.

---

## Scopes

Scopes are arbitrary strings agreed upon between your application and the agents you authorize. The SDK provides some built-in conventions:

| Scope prefix | Meaning                                 |
| ------------ | --------------------------------------- |
| `read:*`     | Read access to a resource               |
| `write:*`    | Write/mutate access to a resource       |
| `reveal:*`   | Bypass PII masking for a specific field |
| `admin:*`    | Administrative operations               |

The privacy layer (Layer 5) specifically checks for `reveal:` scopes when deciding whether to mask PII fields.

---

## Token Issuance

```typescript
import { issueDelegationToken } from "@agentfriendly/core";

// In your POST /agent-sessions endpoint:
const token = await issueDelegationToken(
  req.user.id, // userId
  req.user.orgId, // tenantId
  ["read:projects", "write:tasks", "reveal:email"],
  config.multitenancy, // contains tokenSecret and ttl
);

res.json({ token, expiresIn: 86400 });
```

---

## Token Validation

Validation runs automatically in the middleware pipeline. If `X-Agent-Session` is present:

1. JWT is decoded and verified (signature, expiry, audience).
2. `jti` (JWT ID) is checked against the in-memory revocation list.
3. On success: `tenantContext` is injected into `AgentContext`.
4. On failure: the request continues with `tenantContext: null` (not a hard reject — access control rules decide).

---

## Session Revocation

Tokens can be revoked before expiry:

```typescript
import { revokeSession } from "@agentfriendly/core";

// User clicks "Revoke agent access" in their settings
await revokeSession(tokenJti, config.multitenancy);
```

The in-memory CRL (Certificate Revocation List) is checked on every validation. In a distributed deployment, use the `RevocationStore` interface to back the CRL with Redis or a database.

---

## Using Tenant Context in Your Code

```typescript
import { getAgentContext } from "@agentfriendly/core";

async function getProjects(req) {
  const ctx = getAgentContext();

  if (ctx?.tenantContext) {
    // Agent request — scope to this user/tenant
    return db.projects.findAll({
      where: { userId: ctx.tenantContext.userId },
    });
  }

  // Human request — use session from cookie/JWT
  return db.projects.findAll({
    where: { userId: req.session.userId },
  });
}
```

---

## Configuration

```typescript
multitenancy: {
  enabled: true,
  tokenSecret: process.env.AGENT_SESSION_SECRET!, // HS256 signing secret
  tokenTtl: 86400,    // 24 hours in seconds
  issuer: "https://yourapp.com",
  audience: "https://yourapp.com",
}
```

---

## Security Model

- Tokens are HS256-signed. Use a strong random secret (≥ 32 bytes).
- Tokens expire after `tokenTtl` seconds.
- Revoked tokens are tracked in memory (or pluggable store) until expiry.
- The `act.sub` (userId) is never modifiable by the agent — it is set server-side at issuance.
- Scopes are also set server-side at issuance. The agent cannot escalate its own scopes.
