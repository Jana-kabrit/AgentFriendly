import { describe, it, expect } from "vitest";

import { evaluatePolicy, meetsMinimumTier, generateRobotsTxtAiSection } from "../../src/access/policy-engine.js";

import type { AgentContext } from "../../src/types/agent-context.js";
import type { AccessConfig } from "../../src/types/config.js";

// Helper to build a minimal AgentContext for testing
function makeContext(overrides: Partial<AgentContext>): AgentContext {
  return {
    requestId: "test-req-001",
    receivedAt: new Date().toISOString(),
    tier: "known-agent",
    tierResolution: { tier: "known-agent", signals: ["ua-database"], reason: "test" },
    isAgent: true,
    userAgent: "GPTBot/1.0",
    matchedAgent: {
      pattern: "GPTBot",
      matchType: "prefix",
      agentName: "GPTBot",
      operator: "OpenAI",
      operatorUrl: "https://openai.com",
      category: "training-crawler",
      description: "OpenAI training crawler",
      verificationSupport: false,
      firstSeen: "2023-08-01",
      sources: [],
    },
    agentCategory: "training-crawler",
    signals: ["ua-database"],
    verifiedIdentity: null,
    tenantContext: null,
    requestedMarkdown: false,
    path: "/docs/getting-started",
    method: "GET",
    headers: {},
    trace: [],
    ...overrides,
  } as AgentContext;
}

describe("evaluatePolicy", () => {
  it("allows requests when no restrictions are configured", () => {
    const ctx = makeContext({});
    const result = evaluatePolicy(ctx, {});
    expect(result.decision).toBe("allow");
  });

  it("allows human requests always", () => {
    const ctx = makeContext({ isAgent: false, tier: "human" });
    const result = evaluatePolicy(ctx, { deny: ["/**"] });
    expect(result.decision).toBe("allow");
  });

  it("denies requests matching a deny glob pattern", () => {
    const ctx = makeContext({ path: "/admin/users" });
    const config: AccessConfig = { deny: ["/admin/**"] };
    const result = evaluatePolicy(ctx, config);
    expect(result.decision).toBe("deny");
    expect(result.statusCode).toBe(403);
  });

  it("allows requests explicitly in the allow list even if deny pattern matches", () => {
    const ctx = makeContext({ path: "/admin/public" });
    const config: AccessConfig = { deny: ["/admin/**"], allow: ["/admin/public"] };
    const result = evaluatePolicy(ctx, config);
    expect(result.decision).toBe("allow");
  });

  it("denies all training-crawlers when policy is deny-all", () => {
    const ctx = makeContext({ agentCategory: "training-crawler" });
    const config: AccessConfig = { agentTypes: { "training-crawler": "deny-all" } };
    const result = evaluatePolicy(ctx, config);
    expect(result.decision).toBe("deny");
  });

  it("allows search-bots when policy is allow-all", () => {
    const ctx = makeContext({
      agentCategory: "search-bot",
      matchedAgent: {
        pattern: "PerplexityBot",
        matchType: "prefix",
        agentName: "PerplexityBot",
        operator: "Perplexity AI",
        operatorUrl: "https://www.perplexity.ai",
        category: "search-bot",
        description: "Perplexity search bot",
        verificationSupport: false,
        firstSeen: "2023-03-01",
        sources: [],
      },
    });
    const config: AccessConfig = { agentTypes: { "search-bot": "allow-all" } };
    const result = evaluatePolicy(ctx, config);
    expect(result.decision).toBe("allow");
  });

  it("denies operator when operator policy is deny-all", () => {
    const ctx = makeContext({});
    const config: AccessConfig = { operators: { OpenAI: "deny-all" } };
    const result = evaluatePolicy(ctx, config);
    expect(result.decision).toBe("deny");
  });
});

describe("meetsMinimumTier", () => {
  it("allows verified-agent on all tiers", () => {
    expect(meetsMinimumTier("verified-agent", "human")).toBe(true);
    expect(meetsMinimumTier("verified-agent", "suspected-agent")).toBe(true);
    expect(meetsMinimumTier("verified-agent", "known-agent")).toBe(true);
    expect(meetsMinimumTier("verified-agent", "verified-agent")).toBe(true);
  });

  it("blocks human from anything above human", () => {
    expect(meetsMinimumTier("human", "human")).toBe(true);
    expect(meetsMinimumTier("human", "suspected-agent")).toBe(false);
    expect(meetsMinimumTier("human", "known-agent")).toBe(false);
    expect(meetsMinimumTier("human", "verified-agent")).toBe(false);
  });

  it("known-agent can access known-agent routes but not verified-only", () => {
    expect(meetsMinimumTier("known-agent", "known-agent")).toBe(true);
    expect(meetsMinimumTier("known-agent", "verified-agent")).toBe(false);
  });
});

describe("generateRobotsTxtAiSection", () => {
  it("generates deny-all for training crawlers", () => {
    const config: AccessConfig = {
      agentTypes: { "training-crawler": "deny-all" },
    };
    const output = generateRobotsTxtAiSection(config);
    expect(output).toContain("User-agent: GPTBot");
    expect(output).toContain("User-agent: ClaudeBot");
    expect(output).toContain("Disallow: /");
  });

  it("generates allow for search bots", () => {
    const config: AccessConfig = {
      agentTypes: { "search-bot": "allow-all" },
    };
    const output = generateRobotsTxtAiSection(config);
    expect(output).toContain("User-agent: PerplexityBot");
    expect(output).toContain("Allow: /");
  });

  it("returns empty string when no agentTypes configured", () => {
    const output = generateRobotsTxtAiSection({});
    expect(output.trim()).toContain("generated by @agentfriendly");
  });
});
