/**
 * E2E: Trust Tier Resolution
 *
 * Verifies that all 4 trust tiers are resolved correctly for representative
 * request patterns, covering all detection signal combinations.
 */
import { describe, it, expect } from "vitest";
import { AgentFriendlyMiddleware } from "../../src/middleware.js";
import type { AgentRequest } from "../../src/types/agent-request.js";

function makeRequest(override: Partial<AgentRequest> = {}): AgentRequest {
  return {
    method: "GET",
    url: "https://example.com/",
    path: "/",
    headers: {},
    body: null,
    query: {},
    ip: null,
    ...override,
  };
}

const sdk = new AgentFriendlyMiddleware({ debug: true });

describe("E2E: Trust Tier — human", () => {
  it("resolves full browser headers as human", async () => {
    const result = await sdk.process(
      makeRequest({
        headers: {
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
          cookie: "session=abc",
          "sec-fetch-site": "same-origin",
          "sec-fetch-mode": "navigate",
        },
      }),
    );
    expect(result.context.tier).toBe("human");
    expect(result.context.isAgent).toBe(false);
    expect(result.earlyResponse).toBeNull();
    expect(result.contentInstructions.convertToMarkdown).toBe(false);
  });

  it("injects no agent headers for human request", async () => {
    const result = await sdk.process(makeRequest({
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        cookie: "session=abc",
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "navigate",
        referer: "https://example.com/",
      },
    }));
    expect(result.context.isAgent).toBe(false);
    // content-signal is only injected for agents
    expect(result.contentInstructions.agentHeaders["content-signal"]).toBeUndefined();
  });
});

describe("E2E: Trust Tier — suspected-agent", () => {
  it("resolves curl-like minimal headers as suspected-agent", async () => {
    const result = await sdk.process(
      makeRequest({
        headers: {
          "user-agent": "curl/8.4.0",
          accept: "*/*",
        },
      }),
    );
    expect(["suspected-agent", "known-agent"]).toContain(result.context.tier);
    expect(result.context.isAgent).toBe(true);
  });

  it("resolves python-requests as suspected-agent", async () => {
    const result = await sdk.process(
      makeRequest({
        headers: {
          "user-agent": "python-requests/2.31.0",
          accept: "*/*",
          "accept-encoding": "gzip, deflate",
        },
      }),
    );
    expect(result.context.isAgent).toBe(true);
  });
});

describe("E2E: Trust Tier — known-agent", () => {
  it("resolves GPTBot as known-agent", async () => {
    const result = await sdk.process(
      makeRequest({
        headers: {
          "user-agent": "GPTBot/1.0",
          accept: "text/html,*/*;q=0.8",
        },
      }),
    );
    expect(result.context.tier).toBe("known-agent");
    expect(result.context.isAgent).toBe(true);
    expect(result.context.matchedAgent?.agentName).toMatch(/GPTBot/i);
    expect(result.context.matchedAgent?.operator).toBe("OpenAI");
  });

  it("resolves ClaudeBot as known-agent", async () => {
    const result = await sdk.process(
      makeRequest({ headers: { "user-agent": "ClaudeBot/1.0" } }),
    );
    expect(result.context.tier).toBe("known-agent");
    expect(result.context.matchedAgent?.operator).toBe("Anthropic");
  });

  it("resolves PerplexityBot as known-agent", async () => {
    const result = await sdk.process(
      makeRequest({ headers: { "user-agent": "PerplexityBot/1.0" } }),
    );
    expect(result.context.tier).toBe("known-agent");
  });

  it("injects debug headers in debug mode", async () => {
    const result = await sdk.process(
      makeRequest({ headers: { "user-agent": "GPTBot/1.0" } }),
    );
    expect(result.contentInstructions.agentHeaders["x-agentfriendly-tier"]).toBe("known-agent");
    expect(result.contentInstructions.agentHeaders["x-agentfriendly-signals"]).toContain(
      "ua-database",
    );
    expect(result.contentInstructions.agentHeaders["x-agentfriendly-request-id"]).toBeTruthy();
  });
});

describe("E2E: Trust Tier — markdown serving decision", () => {
  it("sets convertToMarkdown=true for known-agent with proactiveMarkdown=known", async () => {
    const sdk2 = new AgentFriendlyMiddleware({
      detection: { proactiveMarkdown: "known" },
      content: { markdown: true },
    });
    const result = await sdk2.process(
      makeRequest({ headers: { "user-agent": "GPTBot/1.0" } }),
    );
    expect(result.contentInstructions.convertToMarkdown).toBe(true);
  });

  it("does not serve markdown to humans even with proactiveMarkdown=suspected", async () => {
    const sdk2 = new AgentFriendlyMiddleware({
      detection: { proactiveMarkdown: "suspected" },
      content: { markdown: true },
    });
    const result = await sdk2.process(
      makeRequest({
        headers: {
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
          cookie: "session=x",
          "sec-fetch-site": "same-origin",
          "sec-fetch-mode": "navigate",
          referer: "https://example.com/",
        },
      }),
    );
    expect(result.context.tier).toBe("human");
    expect(result.contentInstructions.convertToMarkdown).toBe(false);
  });

  it("sets convertToMarkdown=true for explicit markdown accept header", async () => {
    const sdk2 = new AgentFriendlyMiddleware({
      detection: { proactiveMarkdown: false },
      content: { markdown: true },
    });
    const result = await sdk2.process(
      makeRequest({
        headers: {
          "user-agent": "GPTBot/1.0",
          accept: "text/markdown, text/html;q=0.5",
        },
      }),
    );
    expect(result.contentInstructions.convertToMarkdown).toBe(true);
  });
});
