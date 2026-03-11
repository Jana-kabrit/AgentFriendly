/**
 * E2E: Access Control Layer (Layer 4)
 *
 * Verifies route deny, allow, per-operator policies, and rate limiting.
 */
import { describe, it, expect, beforeEach } from "vitest";

import { AgentFriendlyMiddleware } from "../../src/middleware.js";

import type { AgentRequest } from "../../src/types/agent-request.js";

function agentRequest(path: string, ua = "GPTBot/1.0"): AgentRequest {
  return {
    method: "GET",
    url: `https://example.com${path}`,
    path,
    headers: { "user-agent": ua },
    body: null,
    query: {},
    ip: "198.51.100.1",
  };
}

describe("E2E: Access Control — route deny/allow", () => {
  const sdk = new AgentFriendlyMiddleware({
    access: {
      deny: ["/admin/**", "/private/**"],
      allow: ["/admin/public"],
    },
  });

  it("denies /admin/users (403)", async () => {
    const result = await sdk.process(agentRequest("/admin/users"));
    expect(result.earlyResponse!.status).toBe(403);
    expect(result.earlyResponse!.body).toContain("Access Denied");
  });

  it("denies /private/data (403)", async () => {
    const result = await sdk.process(agentRequest("/private/data"));
    expect(result.earlyResponse!.status).toBe(403);
  });

  it("allows /admin/public (allow overrides deny)", async () => {
    const result = await sdk.process(agentRequest("/admin/public"));
    expect(result.earlyResponse).toBeNull();
  });

  it("allows /products (no deny rule)", async () => {
    const result = await sdk.process(agentRequest("/products"));
    expect(result.earlyResponse).toBeNull();
  });

  it("does not deny for human browser requests", async () => {
    const humanSdk = new AgentFriendlyMiddleware({
      access: { deny: ["/admin/**"] },
    });
    const result = await humanSdk.process({
      method: "GET",
      url: "https://example.com/admin/secret",
      path: "/admin/secret",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        "accept-language": "en-US",
        "sec-fetch-site": "same-origin",
        cookie: "session=1",
      },
      body: null,
      query: {},
      ip: null,
    });
    expect(result.earlyResponse).toBeNull();
    expect(result.context.isAgent).toBe(false);
  });
});

describe("E2E: Access Control — per-category policy", () => {
  const sdk = new AgentFriendlyMiddleware({
    access: {
      agentTypes: { "training-crawler": "deny-all" },
    },
  });

  it("denies GPTBot (training-crawler) with deny-all policy", async () => {
    const result = await sdk.process(agentRequest("/products", "GPTBot/1.0"));
    expect(result.earlyResponse!.status).toBe(403);
  });

  it("allows search bots (OAI-SearchBot) when only training-crawler is denied", async () => {
    const result = await sdk.process(agentRequest("/products", "OAI-SearchBot/1.0"));
    // OAI-SearchBot is a search-bot category, not training-crawler
    expect(result.earlyResponse).toBeNull();
  });
});

describe("E2E: Access Control — rate limiting", () => {
  let sdk: AgentFriendlyMiddleware;

  beforeEach(() => {
    sdk = new AgentFriendlyMiddleware({
      access: {
        rateLimit: { maxRequests: 3, windowSeconds: 60, keyBy: "ua" },
      },
    });
  });

  it("allows first 3 requests then returns 429", async () => {
    const req = agentRequest("/api/data");

    for (let i = 0; i < 3; i++) {
      const result = await sdk.process(req);
      expect(result.earlyResponse?.status).not.toBe(429);
    }

    const result = await sdk.process(req);
    expect(result.earlyResponse!.status).toBe(429);
    expect(result.earlyResponse!.headers["Retry-After"]).toBeDefined();
  });
});
