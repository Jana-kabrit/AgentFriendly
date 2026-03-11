import { describe, it, expect } from "vitest";

import {
  buildContentSignalHeader,
  shouldServeMarkdown,
  isExcludedFromMarkdown,
} from "../../src/content/negotiator.js";
import type { AgentContext } from "../../src/types/agent-context.js";
import type { ContentConfig } from "../../src/types/config.js";

function makeContext(overrides: Partial<AgentContext>): AgentContext {
  return {
    requestId: "test",
    receivedAt: new Date().toISOString(),
    tier: "known-agent",
    tierResolution: { tier: "known-agent", signals: ["ua-database"], reason: "test" },
    isAgent: true,
    userAgent: "GPTBot/1.0",
    matchedAgent: null,
    agentCategory: null,
    signals: [],
    verifiedIdentity: null,
    tenantContext: null,
    requestedMarkdown: false,
    path: "/docs/intro",
    method: "GET",
    headers: {},
    trace: [],
    ...overrides,
  } as AgentContext;
}

describe("buildContentSignalHeader", () => {
  it("builds header with all defaults (ai-train=no)", () => {
    const header = buildContentSignalHeader({});
    expect(header).toContain("ai-train=no");
    expect(header).toContain("ai-input=yes");
    expect(header).toContain("search=yes");
  });

  it("builds header with custom signals", () => {
    const header = buildContentSignalHeader({ "ai-train": true, "ai-input": false });
    expect(header).toContain("ai-train=yes");
    expect(header).toContain("ai-input=no");
  });
});

describe("shouldServeMarkdown", () => {
  it("returns false for human requests", () => {
    const ctx = makeContext({ isAgent: false, tier: "human" });
    expect(shouldServeMarkdown(ctx, { markdown: true }, "known")).toBe(false);
  });

  it("returns false when markdown config is false", () => {
    const ctx = makeContext({});
    expect(shouldServeMarkdown(ctx, { markdown: false }, "known")).toBe(false);
  });

  it("returns true for known-agent with proactiveMarkdown=known", () => {
    const ctx = makeContext({ tier: "known-agent" });
    expect(shouldServeMarkdown(ctx, {}, "known")).toBe(true);
  });

  it("returns false for suspected-agent with proactiveMarkdown=known", () => {
    const ctx = makeContext({ tier: "suspected-agent" });
    expect(shouldServeMarkdown(ctx, {}, "known")).toBe(false);
  });

  it("returns true for suspected-agent with proactiveMarkdown=suspected", () => {
    const ctx = makeContext({ tier: "suspected-agent" });
    expect(shouldServeMarkdown(ctx, {}, "suspected")).toBe(true);
  });

  it("returns false for known-agent with proactiveMarkdown=verified", () => {
    const ctx = makeContext({ tier: "known-agent" });
    expect(shouldServeMarkdown(ctx, {}, "verified")).toBe(false);
  });

  it("returns true for verified-agent with proactiveMarkdown=verified", () => {
    const ctx = makeContext({ tier: "verified-agent" });
    expect(shouldServeMarkdown(ctx, {}, "verified")).toBe(true);
  });

  it("returns true when requestedMarkdown=true regardless of proactiveMarkdown setting", () => {
    const ctx = makeContext({ tier: "suspected-agent", requestedMarkdown: true });
    expect(shouldServeMarkdown(ctx, {}, false)).toBe(true);
  });

  it("returns false for known-agent with proactiveMarkdown=false and no Accept header", () => {
    const ctx = makeContext({ tier: "known-agent", requestedMarkdown: false });
    expect(shouldServeMarkdown(ctx, {}, false)).toBe(false);
  });
});

describe("isExcludedFromMarkdown", () => {
  it("excludes API paths", () => {
    expect(isExcludedFromMarkdown("/api/users")).toBe(true);
    expect(isExcludedFromMarkdown("/api/v2/search")).toBe(true);
  });

  it("excludes JSON file paths", () => {
    expect(isExcludedFromMarkdown("/data/config.json")).toBe(true);
  });

  it("does not exclude regular doc paths", () => {
    expect(isExcludedFromMarkdown("/docs/getting-started")).toBe(false);
    expect(isExcludedFromMarkdown("/blog/2026/03/post")).toBe(false);
  });

  it("excludes user-configured paths", () => {
    expect(isExcludedFromMarkdown("/internal/report", ["/internal/**"])).toBe(true);
  });
});
