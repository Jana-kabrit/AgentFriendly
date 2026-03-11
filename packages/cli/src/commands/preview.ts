/**
 * `agentfriendly preview` — Preview what an agent sees on a URL
 *
 * Fetches a URL pretending to be GPTBot and shows the markdown response,
 * or shows what would be returned based on the site configuration.
 */

import { header, success, warn, info, label, divider } from "../utils/output.js";

interface PreviewOptions {
  url?: string | undefined;
  ua?: string | undefined;
}

const DEFAULT_AGENT_UA = "GPTBot/1.0 (compatible; @agentfriendly/cli)";

export async function runPreview(options: PreviewOptions): Promise<void> {
  const url = options.url ?? "http://localhost:3000/";
  const ua = options.ua ?? DEFAULT_AGENT_UA;

  header(`Agent Preview: ${url}`);
  divider();
  label("User-Agent", ua);
  label("Accept", "text/markdown, text/html;q=0.5");
  divider();

  let body: string;
  let contentType: string;
  let status: number;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "text/markdown, text/html;q=0.5",
        "User-Agent": ua,
      },
      signal: AbortSignal.timeout(10000),
    });

    status = res.status;
    contentType = res.headers.get("content-type") ?? "";
    body = await res.text();

    label("HTTP status", String(status));
    label("Content-Type", contentType);

    const tokens = res.headers.get("x-markdown-tokens");
    if (tokens) label("x-markdown-tokens", tokens);

    const tier = res.headers.get("x-agentfriendly-tier");
    if (tier) label("x-agentfriendly-tier", tier);

    const signals = res.headers.get("x-agentfriendly-signals");
    if (signals) label("x-agentfriendly-signals", signals);

    const contentSignal = res.headers.get("content-signal");
    if (contentSignal) label("content-signal", contentSignal);
  } catch (err) {
    warn(`Failed to fetch ${url}: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  divider();

  if (status === 402) {
    warn("HTTP 402 — Payment Required. Agent access is monetized.");
    info("Set up x402 payment in your agent client to access this resource.");
  } else if (status === 403) {
    warn("HTTP 403 — Access Denied. This route blocks agent access.");
  } else if (contentType.includes("text/markdown")) {
    success("Server is serving markdown to this agent.");
    divider();
    info("Content preview (first 2000 chars):");
    console.log("");
    console.log(body.slice(0, 2000));
    if (body.length > 2000) {
      console.log(`\n  ... (${body.length - 2000} more characters)`);
    }
  } else {
    warn(`Server returned ${contentType} — markdown conversion may not be enabled.`);
    info("Check your AgentFriendlyConfig.content.markdown setting.");
  }

  divider();
}
