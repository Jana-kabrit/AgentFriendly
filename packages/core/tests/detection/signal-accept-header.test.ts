import { describe, it, expect } from "vitest";

import {
  parseAcceptHeader,
  analyzeAcceptHeader,
  getQualityFor,
} from "../../src/detection/signal-accept-header.js";

describe("parseAcceptHeader", () => {
  it("parses a single MIME type with no quality factor", () => {
    const entries = parseAcceptHeader("text/markdown");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ mimeType: "text/markdown", quality: 1.0 });
  });

  it("parses Claude Code's Accept header", () => {
    const entries = parseAcceptHeader("text/markdown, text/html, */*");
    expect(entries).toHaveLength(3);
    expect(entries[0]?.mimeType).toBe("text/markdown");
    expect(entries[0]?.quality).toBe(1.0);
  });

  it("parses Cursor's Accept header with quality factors", () => {
    const entries = parseAcceptHeader(
      "text/markdown,text/html;q=0.9,application/xhtml+xml;q=0.8,*/*;q=0.5",
    );
    expect(entries).toHaveLength(4);
    // Should be sorted by quality descending
    expect(entries[0]?.mimeType).toBe("text/markdown");
    expect(entries[0]?.quality).toBe(1.0);
    expect(entries[1]?.mimeType).toBe("text/html");
    expect(entries[1]?.quality).toBe(0.9);
  });

  it("parses a browser Accept header", () => {
    const entries = parseAcceptHeader(
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    );
    expect(entries.find((e) => e.mimeType === "text/html")?.quality).toBe(1.0);
    expect(entries.find((e) => e.mimeType === "text/markdown")).toBeUndefined();
  });

  it("handles empty input", () => {
    expect(parseAcceptHeader("")).toHaveLength(0);
  });
});

describe("getQualityFor", () => {
  it("returns the quality for an exact match", () => {
    const entries = parseAcceptHeader("text/markdown;q=0.9");
    expect(getQualityFor(entries, "text/markdown")).toBe(0.9);
  });

  it("returns 0 for types not in the header", () => {
    const entries = parseAcceptHeader("text/html");
    expect(getQualityFor(entries, "text/markdown")).toBe(0);
  });

  it("falls back to wildcard quality", () => {
    const entries = parseAcceptHeader("text/html,*/*;q=0.5");
    expect(getQualityFor(entries, "text/markdown")).toBe(0.5);
  });
});

describe("analyzeAcceptHeader", () => {
  it("returns hasAgentSignal=true for Claude Code's header", () => {
    const result = analyzeAcceptHeader("text/markdown, text/html, */*");
    expect(result.hasAgentSignal).toBe(true);
    expect(result.prefersMarkdown).toBe(true);
    expect(result.prefersAgentJson).toBe(false);
    expect(result.signals).toContain("accept-header");
  });

  it("returns hasAgentSignal=true for application/agent+json", () => {
    const result = analyzeAcceptHeader("application/agent+json, application/json;q=0.9");
    expect(result.hasAgentSignal).toBe(true);
    expect(result.prefersAgentJson).toBe(true);
  });

  it("returns hasAgentSignal=false for a normal browser Accept header", () => {
    const result = analyzeAcceptHeader(
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    );
    expect(result.hasAgentSignal).toBe(false);
    expect(result.prefersMarkdown).toBe(false);
    expect(result.signals).toHaveLength(0);
  });

  it("returns hasAgentSignal=false for undefined", () => {
    const result = analyzeAcceptHeader(undefined);
    expect(result.hasAgentSignal).toBe(false);
    expect(result.signals).toHaveLength(0);
  });

  it("handles text/x-markdown as an alternate MIME type", () => {
    const result = analyzeAcceptHeader("text/x-markdown;q=0.9, text/html;q=0.8");
    expect(result.prefersMarkdown).toBe(true);
  });

  it("does NOT prefer markdown when HTML has higher quality", () => {
    // Edge case: if somehow markdown has lower quality than HTML, don't prefer markdown
    const result = analyzeAcceptHeader("text/html;q=0.9, text/markdown;q=0.5");
    expect(result.prefersMarkdown).toBe(false);
  });
});
