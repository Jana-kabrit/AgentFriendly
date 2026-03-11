import { randomUUID } from "node:crypto";

import { analyzeAcceptHeader } from "./signal-accept-header.js";
import { runHeaderHeuristics } from "./signal-header-heuristics.js";
import { checkUaDatabase } from "./signal-ua-database.js";
import { verifyClawdentityToken } from "./verifier-clawdentity.js";
import { verifyRfc9421Signature } from "./verifier-rfc9421.js";

import type { AgentContext, AgentContextBuilder } from "../types/agent-context.js";
import type { AgentRequest } from "../types/agent-request.js";
import type { DetectionConfig } from "../types/config.js";
import type { DetectionSignal, TrustTier } from "../types/trust-tier.js";


/**
 * Layer 0 — Detection Pipeline
 *
 * Runs all 4 detection signals in the optimal order and resolves a TrustTier.
 * Also runs identity verification (RFC 9421 and Clawdentity) for requests that
 * carry signature or token headers.
 *
 * Signal evaluation order (fastest/cheapest first):
 * 1. Accept Header (synchronous string parsing)
 * 2. UA Database (synchronous hash/prefix lookup)
 * 3. Header Heuristics (synchronous header analysis)
 * 4. Identity Verification (async network call — only if signature headers present)
 *
 * Trust Tier Resolution:
 * - Any valid identity verification → "verified-agent"
 * - UA database match → "known-agent"
 * - Header heuristics above threshold → "suspected-agent"
 * - Accept header signal alone (without UA match) → "suspected-agent"
 * - None of the above → "human"
 */

/**
 * Resolve the trust tier from the collected signals and verification results.
 * The tier is always the highest-trust tier earned by any signal.
 */
function resolveTier(
  signals: DetectionSignal[],
  isVerified: boolean,
  isKnown: boolean,
  isSuspected: boolean,
  requestedMarkdown: boolean,
): { tier: TrustTier; reason: string } {
  if (isVerified) {
    return {
      tier: "verified-agent",
      reason: "Cryptographic identity verification passed (RFC 9421 or Clawdentity AIT)",
    };
  }
  if (isKnown) {
    return {
      tier: "known-agent",
      reason: `User-Agent matched database entry (signals: ${signals.join(", ")})`,
    };
  }
  if (isSuspected || (requestedMarkdown && !isKnown)) {
    return {
      tier: "suspected-agent",
      reason: `Heuristic signals indicate agent traffic (signals: ${signals.join(", ")})`,
    };
  }
  return {
    tier: "human",
    reason: "No agent signals detected — treating as human browser",
  };
}

/**
 * Run the full detection pipeline for a single request.
 * Returns a fully-populated AgentContext.
 *
 * This is an async function because identity verification may require a network
 * call to fetch the agent operator's public key JWKS. The JWKS is cached, so
 * only the first request from a new agent domain incurs the latency.
 */
export async function runDetectionPipeline(
  request: AgentRequest,
  config: DetectionConfig = {},
): Promise<AgentContext> {
  const startTime = Date.now();
  const allSignals: DetectionSignal[] = [];

  // -------------------------------------------------------------------------
  // Signal 1: Accept Header (synchronous)
  // -------------------------------------------------------------------------
  const acceptResult = analyzeAcceptHeader(request.headers["accept"]);
  if (acceptResult.hasAgentSignal) {
    allSignals.push(...acceptResult.signals);
  }

  // -------------------------------------------------------------------------
  // Signal 2: UA Database Lookup (synchronous)
  // -------------------------------------------------------------------------
  const uaResult = checkUaDatabase(request.headers["user-agent"], config.customAgents);
  let matchedAgent = null;
  let agentCategory = null;
  if (uaResult.matched && uaResult.match) {
    allSignals.push(...uaResult.signals);
    matchedAgent = uaResult.match.entry;
    agentCategory = uaResult.match.entry.category;
  }

  // -------------------------------------------------------------------------
  // Signal 3: Header Heuristics (synchronous, only if enabled)
  // -------------------------------------------------------------------------
  let heuristicsIsSuspected = false;
  if (config.headerHeuristics !== false) {
    const heuristicsResult = runHeaderHeuristics(request.headers);
    if (heuristicsResult.isSuspected) {
      allSignals.push(...heuristicsResult.signals);
      heuristicsIsSuspected = true;
    }
  }

  // -------------------------------------------------------------------------
  // Signal 4: Identity Verification (async — only if signature/token headers present)
  // -------------------------------------------------------------------------
  let verifiedIdentity = null;
  const hasSignatureHeaders =
    "signature" in request.headers && "signature-input" in request.headers;
  const hasAgentToken = request.headers["authorization"]?.toLowerCase().startsWith("agenttoken");

  if (hasSignatureHeaders) {
    const rfc9421Result = await verifyRfc9421Signature(request);
    if (rfc9421Result.valid && rfc9421Result.identity) {
      allSignals.push("rfc9421-signature");
      verifiedIdentity = rfc9421Result.identity;
    }
  } else if (hasAgentToken && !verifiedIdentity) {
    const clawdentityResult = await verifyClawdentityToken(request.headers["authorization"]);
    if (clawdentityResult.valid && clawdentityResult.identity) {
      allSignals.push("clawdentity-ait");
      verifiedIdentity = clawdentityResult.identity;
    }
  }

  // -------------------------------------------------------------------------
  // Tier Resolution
  // -------------------------------------------------------------------------
  const isKnown = uaResult.matched;
  const isVerified = verifiedIdentity !== null;
  const isSuspected = heuristicsIsSuspected;

  const { tier, reason } = resolveTier(
    allSignals,
    isVerified,
    isKnown,
    isSuspected,
    acceptResult.prefersMarkdown,
  );

  const isAgent = tier !== "human";

  // -------------------------------------------------------------------------
  // Assemble AgentContext
  // -------------------------------------------------------------------------
  const builder: AgentContextBuilder = {
    requestId: randomUUID(),
    receivedAt: new Date().toISOString(),
    tier,
    tierResolution: {
      tier,
      signals: allSignals,
      reason,
    },
    isAgent,
    userAgent: request.headers["user-agent"] ?? "",
    matchedAgent,
    agentCategory,
    signals: allSignals,
    verifiedIdentity,
    tenantContext: null, // Populated by Layer 8 if delegation token is present
    requestedMarkdown: acceptResult.prefersMarkdown,
    path: request.path,
    method: request.method,
    headers: request.headers,
    trace: [
      {
        layer: "Layer0:Detection",
        action: `Resolved tier="${tier}" via signals=[${allSignals.join(",")}]. ${reason}`,
        durationMs: Date.now() - startTime,
      },
    ],
  };

  // AgentContext is sealed as readonly from the outside; the builder is internal only
  return Object.freeze(builder) as AgentContext;
}
