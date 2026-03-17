/**
 * E2E: Multi-Tenancy Layer (Layer 8)
 *
 * Tests RFC 8693-inspired delegation token issuance, validation,
 * tenant context injection, and session revocation.
 */
import { describe, it, expect } from "vitest";

import { AgentFriendlyMiddleware } from "../../src/middleware.js";
import {
  issueDelegationToken,
  revokeSession as revokeDelegationSession,
} from "../../src/multitenancy/token-issuer.js";

import type { AgentRequest } from "../../src/types/agent-request.js";

const SECRET = "super-secret-test-key-32chars-min-1234";

const sdk = new AgentFriendlyMiddleware({
  multiTenancy: {
    enabled: true,
    tokenSecret: SECRET,
    sessionTtlSeconds: 3600,
  },
});

function agentRequest(token?: string, path = "/dashboard"): AgentRequest {
  const headers: Record<string, string> = { "user-agent": "GPTBot/1.0" };
  if (token) headers["x-agent-session"] = token;
  return {
    method: "GET",
    url: `https://example.com${path}`,
    path,
    headers,
    body: null,
    query: {},
    ip: null,
  };
}

describe("E2E: Multi-Tenancy — token issuance", () => {
  it("issues a delegation token with correct structure", async () => {
    const result = await issueDelegationToken(
      "user-456",
      "tenant-123",
      ["read:products", "write:cart"],
      { enabled: true, tokenSecret: SECRET, sessionTtlSeconds: 3600 },
    );

    expect(result.token).toBeTypeOf("string");
    expect(result.sessionId).toBeTypeOf("string");
    expect(result.expiresAt).toBeTypeOf("string");
  });
});

describe("E2E: Multi-Tenancy — token validation", () => {
  it("injects tenant context for valid X-Agent-Session token", async () => {
    const { token } = await issueDelegationToken("user-789", "acme-corp", ["read:docs"], {
      enabled: true,
      tokenSecret: SECRET,
      sessionTtlSeconds: 3600,
    });

    const result = await sdk.process(agentRequest(token));
    expect(result.context.tenantContext).toBeTruthy();
    expect(result.context.tenantContext!.tenantId).toBe("acme-corp");
    expect(result.context.tenantContext!.userId).toBe("user-789");
    expect(result.context.tenantContext!.grantedScopes).toContain("read:docs");
  });

  it("does not inject tenant context without token", async () => {
    const result = await sdk.process(agentRequest());
    expect(result.context.tenantContext).toBeNull();
  });

  it("does not inject tenant context with invalid token", async () => {
    const result = await sdk.process(agentRequest("invalid.jwt.token"));
    expect(result.context.tenantContext).toBeNull();
  });
});

describe("E2E: Multi-Tenancy — session revocation", () => {
  it("revokes a session and subsequent requests are rejected", async () => {
    const { token, sessionId } = await issueDelegationToken("user-revoke", "tenant-revoke", [], {
      enabled: true,
      tokenSecret: SECRET,
      sessionTtlSeconds: 3600,
    });

    // First request: should have tenant context
    const before = await sdk.process(agentRequest(token));
    expect(before.context.tenantContext).toBeTruthy();

    // Revoke the session
    revokeDelegationSession(sessionId);

    // Second request: tenant context should be null
    const after = await sdk.process(agentRequest(token));
    expect(after.context.tenantContext).toBeNull();
  });
});

describe("E2E: Multi-Tenancy — scope-based PII access", () => {
  it("masking is bypassed for fields in granted scopes", async () => {
    // This tests the integration between multi-tenancy and privacy layers.
    // The actual masking is done by the route handler, not the middleware.
    // Here we just verify that tenant context carries the scopes correctly.
    const { token } = await issueDelegationToken("u1", "t1", ["reveal:email", "read:profile"], {
      enabled: true,
      tokenSecret: SECRET,
      sessionTtlSeconds: 3600,
    });

    const result = await sdk.process(agentRequest(token));
    expect(result.context.tenantContext!.grantedScopes).toContain("reveal:email");
    expect(result.context.tenantContext!.grantedScopes).toContain("read:profile");
  });
});
