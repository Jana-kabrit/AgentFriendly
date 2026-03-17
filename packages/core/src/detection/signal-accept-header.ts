import type { DetectionSignal } from "../types/trust-tier.js";

/**
 * SIGNAL 1: Accept Header Analysis
 *
 * Checks the incoming `Accept` header for explicit AI agent preferences.
 * Three sub-signals are checked:
 * 1. `text/markdown` — the agent explicitly prefers markdown content
 * 2. `application/agent+json` — the agent is looking for an AHP manifest
 * 3. `*\/\*` only (no specific types) — weak signal, agents often send only this
 *
 * This is the most reliable single signal because human browsers never request
 * `text/markdown` or `application/agent+json` as their primary content type.
 *
 * Limitation: Only ~3 of 7 major AI agents send `Accept: text/markdown` as of March 2026.
 * This is why it is combined with UA database and heuristic signals.
 */

/** The quality factor for a MIME type in an Accept header. 1.0 = highest preference. */
interface AcceptEntry {
  readonly mimeType: string;
  readonly quality: number;
}

/**
 * Parse an Accept header value into a sorted list of entries (highest quality first).
 * Example: "text/markdown,text/html;q=0.9,*\/*;q=0.5"
 * → [{ mimeType: "text/markdown", quality: 1.0 }, { mimeType: "text/html", quality: 0.9 }, ...]
 */
export function parseAcceptHeader(acceptHeader: string): AcceptEntry[] {
  return acceptHeader
    .split(",")
    .map((part) => {
      const [rawType, ...params] = part.trim().split(";");
      const mimeType = (rawType ?? "").trim().toLowerCase();
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const quality = qParam ? Number(qParam.replace(/q=/i, "").trim()) : 1.0;
      return { mimeType, quality };
    })
    .filter((e) => e.mimeType.length > 0 && !Number.isNaN(e.quality))
    .sort((a, b) => b.quality - a.quality);
}

/**
 * Get the effective quality factor for a given MIME type from a parsed Accept header.
 * Returns 0 if the type is not present.
 */
export function getQualityFor(entries: AcceptEntry[], mimeType: string): number {
  const exact = entries.find((e) => e.mimeType === mimeType);
  if (exact) return exact.quality;
  // Check wildcard matches (e.g., "text/*" matches "text/markdown")
  const [type] = mimeType.split("/");
  const wildcard = entries.find((e) => e.mimeType === `${type}/*`);
  if (wildcard) return wildcard.quality;
  const starStar = entries.find((e) => e.mimeType === "*/*");
  return starStar?.quality ?? 0;
}

/** Result of analyzing the Accept header for agent signals. */
export interface AcceptHeaderResult {
  /** Whether the client explicitly prefers markdown over HTML. */
  readonly prefersMarkdown: boolean;
  /** Whether the client is requesting the AHP agent manifest. */
  readonly prefersAgentJson: boolean;
  /** Whether any agent-specific MIME type preference was detected. */
  readonly hasAgentSignal: boolean;
  /** The signals that fired as a result of this analysis. */
  readonly signals: readonly DetectionSignal[];
}

/**
 * Analyze the Accept header and return the detected agent signals.
 * Returns an empty result (no signals) if the header is absent or standard-browser.
 */
export function analyzeAcceptHeader(acceptHeader: string | undefined): AcceptHeaderResult {
  if (!acceptHeader) {
    return { prefersMarkdown: false, prefersAgentJson: false, hasAgentSignal: false, signals: [] };
  }

  const entries = parseAcceptHeader(acceptHeader);
  const markdownQ = getQualityFor(entries, "text/markdown");
  const xMarkdownQ = getQualityFor(entries, "text/x-markdown"); // alternate MIME type
  const htmlQ = getQualityFor(entries, "text/html");

  const effectiveMarkdownQ = Math.max(markdownQ, xMarkdownQ);
  const prefersMarkdown = effectiveMarkdownQ > 0 && effectiveMarkdownQ >= htmlQ;

  // Only mark prefersAgentJson=true when explicitly listed — not via wildcard fallback.
  // Any HTTP client that sends */* would otherwise appear to support application/agent+json,
  // producing false positives.
  const prefersAgentJson = entries.some((e) => e.mimeType === "application/agent+json");

  const hasAgentSignal = prefersMarkdown || prefersAgentJson;

  const signals: DetectionSignal[] = [];
  if (hasAgentSignal) {
    signals.push("accept-header");
  }

  return { prefersMarkdown, prefersAgentJson, hasAgentSignal, signals };
}
