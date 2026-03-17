import { describe, it, expect } from "vitest";

import { detectLlmReferral } from "../../src/analytics/collector.js";

describe("detectLlmReferral", () => {
  it("detects perplexity.ai as LLM referral", () => {
    const result = detectLlmReferral("https://www.perplexity.ai/search?q=best+monitoring+tools");
    expect(result).toBe("perplexity.ai");
  });

  it("detects claude.ai as LLM referral", () => {
    const result = detectLlmReferral("https://claude.ai/chat/abc123");
    expect(result).toBe("claude.ai");
  });

  it("detects chat.openai.com as LLM referral", () => {
    const result = detectLlmReferral("https://chat.openai.com/c/abc123");
    expect(result).toBe("chat.openai.com");
  });

  it("returns null for Google referrer", () => {
    const result = detectLlmReferral("https://www.google.com/search?q=test");
    expect(result).toBeNull();
  });

  it("returns null for undefined referrer", () => {
    const result = detectLlmReferral(undefined);
    expect(result).toBeNull();
  });

  it("returns null for direct navigation (empty string)", () => {
    const result = detectLlmReferral("");
    expect(result).toBeNull();
  });

  it("returns null for malformed URLs", () => {
    const result = detectLlmReferral("not-a-url");
    expect(result).toBeNull();
  });

  it("handles www prefix correctly", () => {
    // www.perplexity.ai should still match
    const result = detectLlmReferral("https://www.perplexity.ai/search");
    expect(result).toBe("perplexity.ai");
  });
});
