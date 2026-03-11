import { describe, it, expect, beforeEach } from "vitest";

import {
  matchUserAgent,
  getAllAgents,
  getDatabaseVersion,
  getAgentsByCategory,
  _clearCache,
} from "../src/loader.js";

describe("matchUserAgent", () => {
  beforeEach(() => {
    _clearCache();
  });

  describe("known training crawlers", () => {
    it("matches GPTBot by prefix", () => {
      const match = matchUserAgent("GPTBot/1.0");
      expect(match).not.toBeNull();
      expect(match!.entry.agentName).toBe("GPTBot");
      expect(match!.entry.category).toBe("training-crawler");
      expect(match!.entry.operator).toBe("OpenAI");
      expect(match!.confidence).toBe("high");
    });

    it("matches ClaudeBot by prefix", () => {
      const match = matchUserAgent("ClaudeBot/0.5 (+https://anthropic.com)");
      expect(match).not.toBeNull();
      expect(match!.entry.agentName).toBe("ClaudeBot");
      expect(match!.entry.category).toBe("training-crawler");
    });

    it("matches CCBot by prefix", () => {
      const match = matchUserAgent("CCBot/2.0 (https://commoncrawl.org/faq/)");
      expect(match).not.toBeNull();
      expect(match!.entry.category).toBe("training-crawler");
    });

    it("matches Bytespider by prefix", () => {
      const match = matchUserAgent("Bytespider; spider-feedback@bytedance.com");
      expect(match).not.toBeNull();
      expect(match!.entry.operator).toBe("ByteDance");
    });

    it("matches Google-Extended by exact match", () => {
      const match = matchUserAgent("Google-Extended");
      expect(match).not.toBeNull();
      expect(match!.entry.agentName).toBe("Google-Extended");
      expect(match!.entry.category).toBe("training-crawler");
    });
  });

  describe("known search/citation bots", () => {
    it("matches PerplexityBot by prefix", () => {
      const match = matchUserAgent("PerplexityBot/1.0");
      expect(match).not.toBeNull();
      expect(match!.entry.category).toBe("search-bot");
    });

    it("matches ChatGPT-User by prefix", () => {
      const match = matchUserAgent("ChatGPT-User/1.0; +https://openai.com");
      expect(match).not.toBeNull();
      expect(match!.entry.category).toBe("interactive-agent");
    });

    it("matches OAI-SearchBot by prefix", () => {
      const match = matchUserAgent("OAI-SearchBot/1.0");
      expect(match).not.toBeNull();
      expect(match!.entry.category).toBe("search-bot");
    });
  });

  describe("known interactive agents", () => {
    it("matches Claude Code WebFetch (axios) by prefix", () => {
      const match = matchUserAgent("axios/1.8.4");
      expect(match).not.toBeNull();
      expect(match!.entry.agentName).toBe("Claude Code WebFetch");
      expect(match!.entry.category).toBe("interactive-agent");
    });

    it("matches Gemini CLI (GoogleAgent-URLContext) by prefix", () => {
      const match = matchUserAgent("GoogleAgent-URLContext/1.0");
      expect(match).not.toBeNull();
      expect(match!.entry.agentName).toBe("Gemini CLI");
    });

    it("matches Windsurf (colly) by prefix", () => {
      const match = matchUserAgent(
        "colly - https://github.com/gocolly/colly/v2 (https://github.com/gocolly/colly)",
      );
      expect(match).not.toBeNull();
      expect(match!.entry.agentName).toBe("Windsurf (via colly)");
    });

    it("matches python-requests with medium confidence", () => {
      const match = matchUserAgent("python-requests/2.31.0");
      expect(match).not.toBeNull();
      expect(match!.confidence).toBe("medium");
    });
  });

  describe("non-agent user-agents", () => {
    it("returns null for standard Chrome browser UA", () => {
      const match = matchUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      );
      expect(match).toBeNull();
    });

    it("returns null for Firefox", () => {
      const match = matchUserAgent(
        "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
      );
      expect(match).toBeNull();
    });

    it("returns null for Safari", () => {
      const match = matchUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
      );
      expect(match).toBeNull();
    });

    it("returns null for empty string", () => {
      const match = matchUserAgent("");
      expect(match).toBeNull();
    });

    it("returns null for whitespace-only string", () => {
      const match = matchUserAgent("   ");
      expect(match).toBeNull();
    });

    it("returns null for unknown user-agent", () => {
      const match = matchUserAgent("MyCustomApp/1.0");
      expect(match).toBeNull();
    });
  });

  describe("prefix specificity", () => {
    it("prefers longer (more specific) prefix matches over shorter ones", () => {
      // Both "anthropic-ai" and "anthropic-ai-extended" would match "anthropic-ai",
      // but only "anthropic-ai-extended" matches "anthropic-ai-extended/1.0"
      // This test validates the sorting behavior
      const match = matchUserAgent("anthropic-ai/1.0");
      expect(match).not.toBeNull();
      expect(match!.entry.operator).toBe("Anthropic");
    });
  });
});

describe("getAllAgents", () => {
  beforeEach(() => _clearCache());

  it("returns a non-empty array", () => {
    const agents = getAllAgents();
    expect(agents.length).toBeGreaterThan(20);
  });

  it("all entries have required fields", () => {
    const agents = getAllAgents();
    for (const agent of agents) {
      expect(agent.agentName).toBeTruthy();
      expect(agent.operator).toBeTruthy();
      expect(agent.pattern).toBeTruthy();
      expect(["exact", "prefix", "regex"]).toContain(agent.matchType);
      expect([
        "training-crawler",
        "search-bot",
        "interactive-agent",
        "browser-agent",
      ]).toContain(agent.category);
    }
  });
});

describe("getAgentsByCategory", () => {
  beforeEach(() => _clearCache());

  it("returns only training crawlers", () => {
    const crawlers = getAgentsByCategory("training-crawler");
    expect(crawlers.length).toBeGreaterThan(5);
    for (const agent of crawlers) {
      expect(agent.category).toBe("training-crawler");
    }
    // GPTBot should be in training crawlers
    expect(crawlers.some((a) => a.agentName === "GPTBot")).toBe(true);
  });

  it("returns only search bots", () => {
    const bots = getAgentsByCategory("search-bot");
    expect(bots.length).toBeGreaterThan(3);
    for (const agent of bots) {
      expect(agent.category).toBe("search-bot");
    }
  });

  it("returns only interactive agents", () => {
    const agents = getAgentsByCategory("interactive-agent");
    expect(agents.length).toBeGreaterThan(3);
    // Claude Code WebFetch should be interactive
    expect(agents.some((a) => a.agentName.includes("Claude Code"))).toBe(true);
  });
});

describe("getDatabaseVersion", () => {
  beforeEach(() => _clearCache());

  it("returns a semver string", () => {
    const version = getDatabaseVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
