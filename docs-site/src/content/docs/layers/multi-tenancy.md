---
title: "Layer 8: Multi-Tenancy"
description: Issue scoped agent delegation tokens so agents act on behalf of specific users.
---

# Layer 8: Multi-Tenancy

Multi-tenancy enables agents to act *on behalf of* specific users within a SaaS platform. This is critical when users authorize an AI agent to access their account data — you need to know *whose* data the agent is accessing and *what* it's allowed to do.

## The Problem

Without multi-tenancy:
- An agent accessing `/api/invoices` could receive *all* invoices for *all* tenants.
- There is no way to scope the agent's access to a specific user's data.
- You cannot audit which agent accessed which user's data.

With multi-tenancy:
- The user authorizes the agent via your app's OAuth flow.
- Your server issues a scoped **delegation token** (JWT) to the agent.
- The agent presents the token on every request.
- AgentFriendly validates the token and injects the `TenantContext` into the request context.
- Your route handlers read the `TenantContext` to scope database queries.

## Setup

```typescript
createAgentFriendlyMiddleware({
  multiTenancy: {
    enabled: true,
    tokenSecret: process.env.AGENT_SESSION_SECRET!, // min 32 chars
    sessionTtlSeconds: 3600, // 1 hour
    authorizationPagePath: "/agent-access", // Where users grant access
  },
});
```

## Issuing Delegation Tokens

When a user authorizes an agent, issue a delegation token:

```typescript
import { issueDelegationToken } from "@agentfriendly/core";

// In your OAuth callback or authorization endpoint
const { token, sessionId, expiresAt } = await issueDelegationToken(
  userId,
  tenantId,
  ["read:invoices", "read:profile", "write:notes"],
  config.multiTenancy,
);

// Return the token to the agent
return Response.json({ token, expiresAt });
```

## Reading Tenant Context

In route handlers, read the injected tenant context:

```typescript
import { getAgentContext } from "@agentfriendly/core";

export async function GET(request: Request) {
  const ctx = getAgentContext();
  if (!ctx?.tenantContext) {
    return new Response("No agent session", { status: 401 });
  }

  const { tenantId, userId, grantedScopes } = ctx.tenantContext;

  // Scope your database query to this user's data
  const invoices = await db.invoices.findMany({
    where: { userId, tenantId },
  });

  return Response.json({ invoices });
}
```

## Scoped PII Masking

Delegation tokens can carry `reveal:*` scopes to allow specific PII fields to be unmasked for an agent:

```typescript
// Issue token with reveal scopes
await issueDelegationToken(userId, tenantId, [
  "read:invoices",
  "reveal:email",     // Allow agent to see the email field
  "reveal:phone",     // Allow agent to see the phone field
], config.multiTenancy);
```

```typescript
import { maskJsonFields } from "@agentfriendly/core";
import { getAgentContext } from "@agentfriendly/core";

export async function GET() {
  const ctx = getAgentContext();
  const user = await db.users.findById(ctx!.tenantContext!.userId);

  // mask PII fields unless the agent has reveal: scope
  const safeUser = maskJsonFields(user, ["email", "phone", "ssn"], ctx!);

  return Response.json(safeUser);
}
```

## Session Revocation

Revoke an agent session immediately:

```typescript
import { revokeSession } from "@agentfriendly/core";

// On user logout, agent misbehavior, or token compromise
await revokeSession(sessionId);
```

Revoked sessions are stored in an in-memory CRL (Certificate Revocation List). For multi-instance deployments, persist revocations to a shared store.

## Token Format

Delegation tokens are signed JWTs with RFC 8693-style `act` (actor) claims:

```json
{
  "sub": "agent:6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "jti": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "iat": 1700000000,
  "exp": 1700003600,
  "scope": "read:invoices reveal:email",
  "act": {
    "sub": "user-123",
    "tid": "tenant-456"
  }
}
```

## Token Transport

Agents should present the token in one of:
- `X-Agent-Session: <token>` header (preferred)
- `Authorization: Bearer <token>` header
- `Authorization: AgentSession <token>` header
