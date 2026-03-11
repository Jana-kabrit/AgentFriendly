/**
 * Layer 2 — HTML to Markdown Converter
 *
 * Converts HTML pages to clean markdown for AI agents.
 * Uses two-stage processing:
 * 1. Mozilla Readability — extracts main article content, discards navigation/ads/boilerplate
 * 2. Turndown — converts the cleaned HTML to well-formatted markdown
 *
 * This is the same approach used by Vercel's "Markdown for Agents" implementation
 * and is a proven approach for content extraction.
 *
 * Note: @mozilla/readability and turndown run only in Node.js environments.
 * Edge Runtime (Cloudflare Workers) uses a simplified regex-based approach
 * provided by the edge fallback below.
 */

/** The result of converting HTML to markdown. */
export interface MarkdownConversionResult {
  /** The cleaned markdown content. */
  readonly markdown: string;
  /** Title of the page, extracted by Readability. */
  readonly title: string;
  /**
   * Estimated token count using a simple character-based heuristic.
   * ~4 characters per token is a reasonable estimate for English text.
   * This matches the `x-markdown-tokens` header sent by Cloudflare.
   */
  readonly estimatedTokens: number;
  /** Whether the conversion used Readability (true) or the fallback (false). */
  readonly usedReadability: boolean;
}

/** Elements to strip from HTML before markdown conversion. Always removed. */
const DEFAULT_STRIP_SELECTORS = [
  "nav",
  "header nav",
  "footer",
  "aside",
  ".sidebar",
  ".navigation",
  ".nav",
  ".ads",
  ".advertisement",
  ".cookie-banner",
  ".cookie-notice",
  "[class*='cookie']",
  "[id*='cookie']",
  "[class*='consent']",
  ".modal",
  "[role='dialog']",
  "[aria-hidden='true']",
  "script",
  "style",
  "noscript",
  "iframe",
  "object",
  "embed",
  ".print-only",
  "[class*='social']",
  ".share-buttons",
  ".related-posts",
  ".recommendations",
];

/**
 * Estimate token count from a string.
 * Uses the ~4 chars/token heuristic for English text (similar to cl100k_base).
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Convert HTML to clean markdown using Mozilla Readability + Turndown.
 *
 * This function dynamically imports the required libraries to support:
 * 1. Tree-shaking — the converter is only loaded when actually needed
 * 2. Edge runtime fallback — in environments without jsdom, we use the simple fallback
 *
 * @param html - The raw HTML string to convert
 * @param url - The page URL (used by Readability for link resolution)
 * @param additionalStripSelectors - Extra CSS selectors to strip before conversion
 */
export async function htmlToMarkdown(
  html: string,
  url: string,
  additionalStripSelectors: string[] = [],
): Promise<MarkdownConversionResult> {
  try {
    return await readabilityConvert(html, url, additionalStripSelectors);
  } catch {
    // Fall back to simple stripping if Readability/jsdom is not available
    return simpleFallbackConvert(html);
  }
}

/**
 * Full conversion using @mozilla/readability + jsdom + turndown.
 * Used in Node.js environments.
 */
async function readabilityConvert(
  html: string,
  url: string,
  additionalStripSelectors: string[],
): Promise<MarkdownConversionResult> {
  // Dynamic imports — these are optional dependencies. If not installed, the
  // simpleFallbackConvert is used instead. The try/catch in the caller handles this.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [jsdomMod, readabilityMod, turndownMod] = await Promise.all([
    import("jsdom") as Promise<unknown>,
    import("@mozilla/readability") as Promise<unknown>,
    import("turndown") as Promise<unknown>,
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { JSDOM } = jsdomMod as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { Readability } = readabilityMod as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call
  const dom = new JSDOM(html, { url }) as any;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const document = dom.window.document;

  // Strip noise selectors before Readability runs
  const allSelectors = [...DEFAULT_STRIP_SELECTORS, ...additionalStripSelectors];
  for (const selector of allSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        el.remove();
      }
    } catch {
      // Skip invalid selectors without breaking the conversion
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const reader = new Readability(document) as { parse(): { title: string; content: string } | null };
  const article = reader.parse();

  const title = article?.title ?? document.title ?? "";
  const content = article?.content ?? html;

  // Handle both ESM default export and CommonJS module.exports patterns for turndown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const TdMod = turndownMod as any;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const TurndownServiceClass = TdMod?.default ?? TdMod;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const turndown = new TurndownServiceClass({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    hr: "---",
    linkStyle: "referenced",
    linkReferenceStyle: "full",
  }) as { turndown: (html: string) => string; addRule: (name: string, rule: object) => void };

  // Keep code blocks as-is without further processing
  turndown.addRule("code-block", {
    filter: "pre",
    replacement: (_content: string, node: { textContent: string | null }) => {
      return `\n\`\`\`\n${node.textContent ?? ""}\n\`\`\`\n`;
    },
  });

  const markdown = turndown.turndown(content).trim();
  const estimatedTokens = estimateTokenCount(markdown);

  return { markdown, title, estimatedTokens, usedReadability: true };
}

/**
 * Simple fallback conversion using regex-based stripping.
 * Used in Edge Runtime environments where jsdom/JSDOM is not available.
 * Less accurate than Readability but works in any JavaScript environment.
 */
function simpleFallbackConvert(html: string): MarkdownConversionResult {
  let text = html
    // Remove complete tags and their content for noise elements
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, "")
    .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, "")
    // Convert common structural tags to markdown equivalents
    .replace(/<h1\b[^>]*>(.*?)<\/h1>/gi, "\n# $1\n")
    .replace(/<h2\b[^>]*>(.*?)<\/h2>/gi, "\n## $1\n")
    .replace(/<h3\b[^>]*>(.*?)<\/h3>/gi, "\n### $1\n")
    .replace(/<h4\b[^>]*>(.*?)<\/h4>/gi, "\n#### $1\n")
    .replace(/<strong\b[^>]*>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b\b[^>]*>(.*?)<\/b>/gi, "**$1**")
    .replace(/<em\b[^>]*>(.*?)<\/em>/gi, "_$1_")
    .replace(/<i\b[^>]*>(.*?)<\/i>/gi, "_$1_")
    .replace(/<code\b[^>]*>(.*?)<\/code>/gi, "`$1`")
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)")
    .replace(/<p\b[^>]*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<[^>]+>/g, "") // Strip remaining tags
    // Decode common HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    // Clean up whitespace
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    markdown: text,
    title: "",
    estimatedTokens: estimateTokenCount(text),
    usedReadability: false,
  };
}
