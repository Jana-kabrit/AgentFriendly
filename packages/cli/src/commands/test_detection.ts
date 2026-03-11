/**
 * `agentfriendly test-detection` — Simulate agent detection for a request
 *
 * Runs the detection pipeline locally (without a server) for a given
 * User-Agent string and Accept header, and prints the resolved TrustTier
 * with all contributing signals.
 */

import { runDetectionPipeline } from "@agentfriendly/core";

import { header, success, warn, info, label, divider, badge } from "../utils/output.js";

interface TestDetectionOptions {
  ua?: string | undefined;
  accept?: string | undefined;
  verbose?: boolean | undefined;
}

export async function runTestDetection(options: TestDetectionOptions): Promise<void> {
  const ua = options.ua ?? "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36";
  const acceptHeader = options.accept ?? "text/html,*/*;q=0.8";

  header("Detection Pipeline Simulator");
  divider();
  label("User-Agent", ua);
  label("Accept", acceptHeader);
  divider();

  const headers: Record<string, string> = {
    "user-agent": ua,
    accept: acceptHeader,
  };

  const context = await runDetectionPipeline({
    method: "GET",
    url: "/",
    path: "/",
    headers,
    body: null,
    query: {},
    ip: null,
  });

  console.log(`  Resolved: ${badge(context.tier)}`);
  divider();

  label("is_agent", String(context.isAgent));
  label("tier", context.tier);
  label("signals", context.signals.join(", ") || "none");

  if (context.matchedAgent) {
    divider();
    info("UA Database match:");
    label("agent_name", context.matchedAgent.agentName);
    label("operator", context.matchedAgent.operator);
    label("category", context.matchedAgent.category);
    label("verification", context.matchedAgent.verificationSupport ? "supported" : "not supported");
  }

  if (context.verifiedIdentity) {
    divider();
    info("Verified identity:");
    label("method", context.verifiedIdentity.method);
    label("operator", context.verifiedIdentity.operatorDomain);
    label("agent_id", context.verifiedIdentity.agentId);
  }

  if (options.verbose && context.trace.length > 0) {
    divider();
    info("Pipeline trace:");
    for (const trace of context.trace) {
      label(trace.layer, `${trace.action} (${trace.durationMs.toFixed(1)}ms)`);
    }
  }

  divider();

  // Recommendations
  if (context.tier === "human") {
    info("This request looks like a human — no agent handling will be applied.");
  } else if (context.tier === "suspected-agent") {
    warn("Suspected agent — consider enabling proactiveMarkdown: 'suspected'.");
  } else if (context.tier === "known-agent") {
    success("Known agent detected — SDK will serve markdown and apply agent policies.");
  } else if (context.tier === "verified-agent") {
    success("Verified agent — full trust; all agent features apply.");
  }

  divider();
}
