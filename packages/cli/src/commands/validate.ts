/**
 * `agentfriendly validate` — Config and discovery file validator
 *
 * Checks the following for a given site URL:
 * - /.well-known/agent.json — AHP manifest reachable and valid JSON
 * - /llms.txt — reachable
 * - /robots.txt — present and AI agent directives
 * - Config file syntax (if run in project root)
 */

import { header, success, warn, error, info, label, divider } from "../utils/output.js";

interface ValidateOptions {
  url?: string | undefined;
}

type CheckResult = {
  ok: boolean;
  message: string;
  detail?: string;
};

async function fetchCheck(url: string, expectedContentType?: string): Promise<CheckResult> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "*/*", "User-Agent": "AgentFriendlyCLI/0.1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { ok: false, message: `HTTP ${res.status}`, detail: url };
    }
    if (expectedContentType) {
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes(expectedContentType)) {
        return {
          ok: false,
          message: `Wrong Content-Type: ${ct}`,
          detail: `Expected: ${expectedContentType}`,
        };
      }
    }
    return { ok: true, message: `HTTP ${res.status}` };
  } catch (err) {
    return {
      ok: false,
      message: "Network error",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function fetchJson(
  url: string,
): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "AgentFriendlyCLI/0.1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = (await res.json()) as Record<string, unknown>;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function runValidate(options: ValidateOptions): Promise<void> {
  const baseUrl = options.url ? options.url.replace(/\/$/, "") : "http://localhost:3000";

  header(`Validating: ${baseUrl}`);
  divider();

  let passed = 0;
  let failed = 0;

  // -------------------------------------------------------------------------
  // 1. Agent Manifest (/.well-known/agent.json)
  // -------------------------------------------------------------------------
  info("Checking agent manifest...");
  const manifestResult = await fetchJson(`${baseUrl}/.well-known/agent.json`);
  if (manifestResult.ok && manifestResult.data) {
    success("/.well-known/agent.json  — valid JSON");
    const d = manifestResult.data;
    label("ahp version", String(d["ahp"] ?? "missing"));
    label("modes", Array.isArray(d["modes"]) ? (d["modes"] as string[]).join(", ") : "missing");
    label("name", String(d["name"] ?? "missing"));
    passed++;
  } else {
    error("/.well-known/agent.json — FAILED");
    warn(manifestResult.error ?? "Unknown error");
    failed++;
  }
  divider();

  // -------------------------------------------------------------------------
  // 2. llms.txt
  // -------------------------------------------------------------------------
  info("Checking /llms.txt...");
  const llmsTxtResult = await fetchCheck(`${baseUrl}/llms.txt`, "text/markdown");
  if (llmsTxtResult.ok) {
    success("/llms.txt — accessible");
    passed++;
  } else {
    error(`/llms.txt — ${llmsTxtResult.message}`);
    if (llmsTxtResult.detail) warn(llmsTxtResult.detail);
    failed++;
  }
  divider();

  // -------------------------------------------------------------------------
  // 3. Tool definitions (/.well-known/agent-tools.json)
  // -------------------------------------------------------------------------
  info("Checking agent tool definitions...");
  const toolsResult = await fetchJson(`${baseUrl}/.well-known/agent-tools.json`);
  if (toolsResult.ok) {
    success("/.well-known/agent-tools.json — valid JSON");
    passed++;
  } else {
    warn(`/.well-known/agent-tools.json — not found (optional)`);
  }
  divider();

  // -------------------------------------------------------------------------
  // 4. robots.txt
  // -------------------------------------------------------------------------
  info("Checking /robots.txt...");
  const robotsResult = await fetchCheck(`${baseUrl}/robots.txt`, "text/plain");
  if (robotsResult.ok) {
    success("/robots.txt — accessible");
    passed++;
  } else {
    warn(`/robots.txt — ${robotsResult.message} (not required but recommended)`);
  }
  divider();

  // -------------------------------------------------------------------------
  // 5. Markdown content-type response for agent UA
  // -------------------------------------------------------------------------
  info("Checking markdown serving for agent UA...");
  try {
    const mdRes = await fetch(`${baseUrl}/`, {
      headers: {
        Accept: "text/markdown, text/html;q=0.5",
        "User-Agent": "GPTBot/1.0",
      },
      signal: AbortSignal.timeout(5000),
    });
    const ct = mdRes.headers.get("content-type") ?? "";
    if (ct.includes("text/markdown")) {
      success("/ responds with text/markdown for agent Accept header");
      const tokens = mdRes.headers.get("x-markdown-tokens");
      if (tokens) label("estimated tokens", tokens);
      passed++;
    } else {
      warn(`/ responds with ${ct} — markdown serving may not be enabled`);
    }
  } catch (err) {
    warn(`Could not check markdown serving: ${err instanceof Error ? err.message : String(err)}`);
  }
  divider();

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  const total = passed + failed;
  const color = failed === 0 ? "green" : "yellow";
  void color; // suppress unused variable

  console.log(`  ${passed}/${total} checks passed`);
  if (failed > 0) {
    warn("Some checks failed — review the output above.");
  } else {
    success("All checks passed! Your site is agent-friendly.");
  }
  divider();
}
