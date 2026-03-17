/**
 * E2E: PII Masking (Layer 5)
 *
 * Tests full-pipeline PII masking with text and JSON field masking,
 * including scope-based unmasking via multi-tenancy tokens.
 */
import { describe, it, expect } from "vitest";

import { maskTextContent, maskJsonFields } from "../../src/privacy/masker.js";

import type { AgentContext } from "../../src/types/agent-context.js";
import type { ResolvedConfig } from "../../src/types/config.js";

function makeAgentContext(scopes: string[] = []): AgentContext {
  return {
    requestId: "e2e-test",
    receivedAt: new Date().toISOString(),
    tier: "known-agent",
    signals: ["ua-database"],
    isAgent: true,
    userAgent: "GPTBot/1.0",
    matchedAgent: null,
    agentCategory: null,
    verifiedIdentity: null,
    tenantContext:
      scopes.length > 0
        ? {
            tenantId: "t1",
            userId: "u1",
            sessionId: "s1",
            grantedScopes: scopes,
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          }
        : null,
    requestedMarkdown: true,
    tierResolution: { tier: "known-agent", signals: ["ua-database"], reason: "UA matched" },
    path: "/",
    method: "GET",
    headers: {},
    query: {},
    ip: null,
    trace: [],
  };
}

function enabledPrivacyConfig(): ResolvedConfig["privacy"] {
  return {
    enabled: true,
    additionalPatterns: [],
    nerEnabled: false,
    reversibleTokenization: false,
    applyToRoutes: ["**"],
    excludeRoutes: [],
  };
}

describe("E2E: PII Masking — text content", () => {
  const config = enabledPrivacyConfig();

  it("masks email addresses", () => {
    const result = maskTextContent(
      "Contact support at helpdesk@example.com for assistance.",
      config,
    );
    expect(result).not.toContain("helpdesk@example.com");
    expect(result).toContain("[EMAIL]");
  });

  it("masks US phone numbers", () => {
    const result = maskTextContent("Call us at 555-123-4567 or (800) 555-0100.", config);
    expect(result).not.toContain("555-123-4567");
    expect(result).toContain("[PHONE]");
  });

  it("masks Social Security Numbers", () => {
    const result = maskTextContent("SSN on file: 123-45-6789", config);
    expect(result).not.toContain("123-45-6789");
    expect(result).toContain("[SSN]");
  });

  it("masks credit card numbers", () => {
    const result = maskTextContent("Card: 4111 1111 1111 1111 expires 12/26", config);
    expect(result).not.toContain("4111");
    expect(result).toContain("[CREDIT_CARD]");
  });

  it("masks IP addresses", () => {
    const result = maskTextContent("Server IP: 192.168.1.100", config);
    expect(result).not.toContain("192.168.1.100");
    expect(result).toContain("[IP_ADDRESS]");
  });

  it("leaves non-PII content unchanged", () => {
    const text = "The price is $49.99 per month.";
    const result = maskTextContent(text, config);
    expect(result).toBe(text);
  });

  it("does not mask when privacy is disabled", () => {
    const disabledConfig = { ...config, enabled: false };
    const text = "Email: user@example.com";
    const result = maskTextContent(text, disabledConfig);
    expect(result).toBe(text);
  });
});

describe("E2E: PII Masking — JSON field masking", () => {
  it("masks top-level sensitive fields", () => {
    const obj = { name: "Alice", email: "alice@example.com", role: "admin" };
    const result = maskJsonFields(obj, ["email"], makeAgentContext());
    expect(result.email).toBe("[REDACTED]");
    expect(result.name).toBe("Alice");
    expect(result.role).toBe("admin");
  });

  it("masks nested fields with dot notation", () => {
    const obj = {
      user: { ssn: "123-45-6789", firstName: "Bob" },
    };
    const result = maskJsonFields(obj, ["user.ssn"], makeAgentContext());
    expect(result.user.ssn).toBe("[REDACTED]");
    expect(result.user.firstName).toBe("Bob");
  });

  it("masks fields in arrays", () => {
    const obj = {
      users: [
        { email: "a@example.com", name: "Alice" },
        { email: "b@example.com", name: "Bob" },
      ],
    };
    const result = maskJsonFields(obj, ["users.email"], makeAgentContext());
    expect(result.users[0].email).toBe("[REDACTED]");
    expect(result.users[1].email).toBe("[REDACTED]");
    expect(result.users[0].name).toBe("Alice");
  });

  it("reveals field when tenant has reveal: scope", () => {
    const obj = { email: "alice@example.com", name: "Alice" };
    const contextWithReveal = makeAgentContext(["reveal:email"]);
    const result = maskJsonFields(obj, ["email"], contextWithReveal);
    expect(result.email).toBe("alice@example.com");
  });

  it("masks field for different tenant without reveal: scope", () => {
    const obj = { email: "alice@example.com" };
    const contextWithoutReveal = makeAgentContext(["read:profile"]);
    const result = maskJsonFields(obj, ["email"], contextWithoutReveal);
    expect(result.email).toBe("[REDACTED]");
  });

  it("does not mutate the original object", () => {
    const obj = { email: "alice@example.com" };
    maskJsonFields(obj, ["email"], makeAgentContext());
    expect(obj.email).toBe("alice@example.com");
  });
});
