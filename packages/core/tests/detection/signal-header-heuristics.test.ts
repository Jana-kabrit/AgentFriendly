import { describe, it, expect } from "vitest";

import { runHeaderHeuristics } from "../../src/detection/signal-header-heuristics.js";

const FULL_BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "accept-encoding": "gzip, deflate, br",
  cookie: "session=abc123; _ga=GA1.1.xxxx",
  "sec-fetch-site": "same-origin",
  "sec-fetch-mode": "navigate",
  "sec-fetch-dest": "document",
  referer: "https://www.google.com/",
};

const MINIMAL_AGENT_HEADERS = {
  "user-agent": "python-requests/2.31.0",
};

describe("runHeaderHeuristics", () => {
  it("does NOT classify a full browser request as suspected agent", () => {
    const result = runHeaderHeuristics(FULL_BROWSER_HEADERS);
    expect(result.isSuspected).toBe(false);
    expect(result.signals).toHaveLength(0);
  });

  it("classifies a bare programmatic request as suspected agent", () => {
    const result = runHeaderHeuristics(MINIMAL_AGENT_HEADERS);
    expect(result.isSuspected).toBe(true);
    expect(result.signals).toContain("header-heuristics");
  });

  it("fires the missing-accept-language heuristic for agents without it", () => {
    const result = runHeaderHeuristics({ "user-agent": "my-agent/1.0" });
    const score = result.scores.find((s) => s.name === "missing-accept-language");
    expect(score?.fired).toBe(true);
    expect(score?.weight).toBeGreaterThan(0);
  });

  it("does NOT fire missing-accept-language for browsers", () => {
    const result = runHeaderHeuristics(FULL_BROWSER_HEADERS);
    const score = result.scores.find((s) => s.name === "missing-accept-language");
    expect(score?.fired).toBe(false);
  });

  it("fires the agent-custom-header heuristic when X-Agent-* header is present", () => {
    const result = runHeaderHeuristics({
      "user-agent": "MyAgent/1.0",
      "x-agent-id": "agent-abc123",
    });
    const score = result.scores.find((s) => s.name === "agent-custom-header");
    expect(score?.fired).toBe(true);
    expect(result.isSuspected).toBe(true);
  });

  it("fires no-sec-fetch-headers heuristic for non-browser clients", () => {
    const result = runHeaderHeuristics({ "user-agent": "curl/7.88.1" });
    const score = result.scores.find((s) => s.name === "no-sec-fetch-headers");
    expect(score?.fired).toBe(true);
  });

  it("does NOT fire no-sec-fetch-headers for browsers", () => {
    const result = runHeaderHeuristics(FULL_BROWSER_HEADERS);
    const score = result.scores.find((s) => s.name === "no-sec-fetch-headers");
    expect(score?.fired).toBe(false);
  });

  it("includes total score in the result", () => {
    const result = runHeaderHeuristics(MINIMAL_AGENT_HEADERS);
    expect(result.totalScore).toBeGreaterThan(0);
  });
});
