/**
 * E2E: Discovery Layer (Layer 1)
 *
 * Verifies that all discovery files are served correctly for
 * the correct paths, with correct Content-Type headers.
 */
import { describe, it, expect } from "vitest";
import { AgentFriendlyMiddleware } from "../../src/middleware.js";
import type { AgentRequest } from "../../src/types/agent-request.js";

function makeRequest(path: string, extraHeaders: Record<string, string> = {}): AgentRequest {
  return {
    method: "GET",
    url: `https://example.com${path}`,
    path,
    headers: { "user-agent": "GPTBot/1.0", ...extraHeaders },
    body: null,
    query: {},
    ip: null,
  };
}

const sdk = new AgentFriendlyMiddleware({
  discovery: { agentJson: true, llmsTxt: {}, webagentsMd: true, agentTools: true },
});

describe("E2E: Discovery — /llms.txt", () => {
  it("serves /llms.txt with text/markdown Content-Type", async () => {
    const result = await sdk.process(makeRequest("/llms.txt"));
    expect(result.earlyResponse).toBeTruthy();
    expect(result.earlyResponse!.handled).toBe(true);
    expect(result.earlyResponse!.status).toBe(200);
    expect(result.earlyResponse!.contentType).toContain("text/markdown");
    expect(result.earlyResponse!.body).toContain("# ");
  });

  it("includes Cache-Control header", async () => {
    const result = await sdk.process(makeRequest("/llms.txt"));
    expect(result.earlyResponse!.headers["Cache-Control"]).toContain("max-age");
  });

  it("includes X-Robots-Tag: noindex", async () => {
    const result = await sdk.process(makeRequest("/llms.txt"));
    expect(result.earlyResponse!.headers["X-Robots-Tag"]).toBe("noindex");
  });
});

describe("E2E: Discovery — /.well-known/agent.json", () => {
  it("serves agent.json as valid JSON", async () => {
    const result = await sdk.process(makeRequest("/.well-known/agent.json"));
    expect(result.earlyResponse!.status).toBe(200);
    expect(result.earlyResponse!.contentType).toContain("application/json");
    const parsed = JSON.parse(result.earlyResponse!.body ?? "");
    expect(parsed).toHaveProperty("ahp");
    expect(parsed).toHaveProperty("modes");
    expect(parsed).toHaveProperty("name");
    expect(Array.isArray(parsed.modes)).toBe(true);
  });

  it("includes CORS header", async () => {
    const result = await sdk.process(makeRequest("/.well-known/agent.json"));
    expect(result.earlyResponse!.headers["Access-Control-Allow-Origin"]).toBe("*");
  });
});

describe("E2E: Discovery — /webagents.md", () => {
  it("serves webagents.md with text/markdown Content-Type", async () => {
    const result = await sdk.process(makeRequest("/webagents.md"));
    expect(result.earlyResponse!.status).toBe(200);
    expect(result.earlyResponse!.contentType).toContain("text/markdown");
  });
});

describe("E2E: Discovery — /.well-known/agent-tools.json", () => {
  it("serves agent-tools.json as valid JSON", async () => {
    const result = await sdk.process(makeRequest("/.well-known/agent-tools.json"));
    expect(result.earlyResponse!.status).toBe(200);
    const parsed = JSON.parse(result.earlyResponse!.body ?? "");
    expect(parsed).toHaveProperty("$schema");
    expect(parsed).toHaveProperty("version");
    expect(parsed).toHaveProperty("tools");
  });
});

describe("E2E: Discovery — debug endpoint /agent-debug", () => {
  it("returns 404 when debug mode is disabled", async () => {
    const debugOffSdk = new AgentFriendlyMiddleware({ debug: false });
    const result = await debugOffSdk.process(makeRequest("/agent-debug"));
    expect(result.earlyResponse!.status).toBe(404);
  });

  it("returns pipeline trace JSON when debug mode is enabled", async () => {
    const debugSdk = new AgentFriendlyMiddleware({ debug: true });
    const result = await debugSdk.process(makeRequest("/agent-debug"));
    expect(result.earlyResponse!.status).toBe(200);
    const parsed = JSON.parse(result.earlyResponse!.body ?? "");
    expect(parsed).toHaveProperty("tier");
    expect(parsed).toHaveProperty("isAgent");
    expect(parsed).toHaveProperty("signals");
    expect(parsed).toHaveProperty("trace");
  });
});
