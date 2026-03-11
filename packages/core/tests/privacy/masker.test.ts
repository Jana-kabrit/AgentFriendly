import { describe, it, expect } from "vitest";

import { maskTextContent, maskJsonFields } from "../../src/privacy/masker.js";

import type { AgentContext } from "../../src/types/agent-context.js";
import type { PrivacyConfig } from "../../src/types/config.js";

const baseConfig: PrivacyConfig = { enabled: true };

const makeContext = (grantedScopes: string[] = []): AgentContext =>
  ({
    requestId: "test",
    receivedAt: new Date().toISOString(),
    tier: "known-agent",
    tierResolution: { tier: "known-agent", signals: [], reason: "" },
    isAgent: true,
    userAgent: "",
    matchedAgent: null,
    agentCategory: null,
    signals: [],
    verifiedIdentity: null,
    tenantContext: grantedScopes.length > 0 ? { tenantId: "t1", userId: "u1", sessionId: "s1", grantedScopes, expiresAt: "" } : null,
    requestedMarkdown: false,
    path: "/",
    method: "GET",
    headers: {},
    trace: [],
  }) as AgentContext;

describe("maskTextContent", () => {
  it("masks email addresses", () => {
    const result = maskTextContent("Contact user@example.com for support", baseConfig);
    expect(result).not.toContain("user@example.com");
    expect(result).toContain("[EMAIL]");
  });

  it("masks US phone numbers", () => {
    const result = maskTextContent("Call 555-123-4567 for help", baseConfig);
    expect(result).toContain("[PHONE]");
    expect(result).not.toContain("555-123-4567");
  });

  it("does not mask when privacy is disabled", () => {
    const result = maskTextContent("user@example.com", { enabled: false });
    expect(result).toBe("user@example.com");
  });

  it("applies additional custom patterns", () => {
    const config: PrivacyConfig = {
      enabled: true,
      additionalPatterns: [/EMPLOYEE-\d{4}/gi],
    };
    const result = maskTextContent("Contact EMPLOYEE-1234 for details", config);
    expect(result).not.toContain("EMPLOYEE-1234");
    expect(result).toContain("[REDACTED]");
  });

  it("masks IPv4 addresses", () => {
    const result = maskTextContent("Server at 192.168.1.100 is down", baseConfig);
    expect(result).toContain("[IP_ADDRESS]");
  });
});

describe("maskJsonFields", () => {
  it("masks top-level fields by name", () => {
    const obj = { name: "Alice", email: "alice@example.com", role: "admin" };
    const result = maskJsonFields(obj, ["email"], makeContext());
    expect(result["email"]).toBe("[REDACTED]");
    expect(result["name"]).toBe("Alice");
    expect(result["role"]).toBe("admin");
  });

  it("masks nested fields using dot notation", () => {
    const obj = { user: { name: "Bob", email: "bob@example.com" } };
    const result = maskJsonFields(obj, ["user.email"], makeContext()) as typeof obj;
    expect(result.user.email).toBe("[REDACTED]");
    expect(result.user.name).toBe("Bob");
  });

  it("does not mutate the original object", () => {
    const obj = { email: "original@example.com" };
    maskJsonFields(obj, ["email"], makeContext());
    expect(obj.email).toBe("original@example.com");
  });

  it("skips fields that do not exist", () => {
    const obj = { name: "Charlie" };
    const result = maskJsonFields(obj, ["email", "phone"], makeContext());
    expect(result["name"]).toBe("Charlie");
    expect(Object.keys(result)).toEqual(["name"]);
  });

  it("unmasks fields when tenant scope includes reveal: prefix", () => {
    const obj = { email: "dave@example.com", name: "Dave" };
    const ctxWithScope = makeContext(["reveal:email"]);
    const result = maskJsonFields(obj, ["email"], ctxWithScope);
    expect(result["email"]).toBe("dave@example.com"); // unmasked due to scope
  });
});
