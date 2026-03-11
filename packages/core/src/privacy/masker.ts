import type { PrivacyConfig } from "../types/config.js";
import type { AgentContext } from "../types/agent-context.js";

import { BUILT_IN_PII_PATTERNS } from "./pii-patterns.js";

/**
 * Layer 5 — PII Masker
 *
 * Masks or tokenizes PII in text content before it is sent to agents.
 *
 * Two modes:
 * 1. One-way masking (default): replaces PII with placeholder strings like [EMAIL].
 *    Simple, fast, irreversible. The agent cannot recover the original value.
 *
 * 2. Reversible tokenization: replaces PII with deterministic tokens like
 *    [EMAIL:tok_a1b2c3d4]. The original value can be recovered by the site's
 *    backend for "round-trip" agentic workflows (where the agent returns the
 *    token and the server looks up the real value).
 *
 * Field-level masking:
 * Tools can declare `piiFields: ["user.email", "address"]` in their `agentMeta`.
 * When a tool response is served to an agent, those JSON fields are masked in
 * the serialized response before transmission.
 *
 * Scope-awareness:
 * When `tenantContext` is present (Layer 8 multi-tenancy), the masker uses the
 * tenant's permission scopes to determine whether a field should be masked.
 * Fields declared in a scope like `read:user:email` are unmasked for agents
 * that have been granted that scope.
 */

/**
 * Mask all PII in a plaintext/markdown string.
 * Used for the HTML→markdown layer output.
 */
export function maskTextContent(
  text: string,
  config: PrivacyConfig,
): string {
  if (!config.enabled) return text;

  const patterns = [
    ...BUILT_IN_PII_PATTERNS,
    ...(config.additionalPatterns ?? []).map((pattern, i) => ({
      name: `custom-${i}`,
      pattern,
      placeholder: "[REDACTED]",
    })),
  ];

  let masked = text;
  for (const { pattern, placeholder } of patterns) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0;
    masked = masked.replace(pattern, placeholder);
  }

  return masked;
}

/**
 * Mask specific fields in a JSON object before serializing for the agent.
 *
 * `piiFields` supports dot notation for nested fields:
 * - "email"           → obj.email
 * - "user.email"      → obj.user.email
 * - "addresses[].zip" → mask 'zip' in every element of obj.addresses array
 *
 * Fields that do not exist in the object are silently skipped.
 */
export function maskJsonFields(
  obj: Record<string, unknown>,
  piiFields: readonly string[],
  context: AgentContext,
): Record<string, unknown> {
  if (piiFields.length === 0) return obj;

  // Determine which fields are allowed by the tenant's granted scopes
  const grantedScopes = context.tenantContext?.grantedScopes ?? [];
  const unmaskedFields = new Set(
    grantedScopes
      .filter((s) => s.startsWith("reveal:"))
      .map((s) => s.replace("reveal:", "")),
  );

  // Deep-clone the object so we do not mutate the original response
  const result = deepClone(obj);

  for (const fieldPath of piiFields) {
    if (unmaskedFields.has(fieldPath)) continue;
    maskFieldPath(result, fieldPath.split("."));
  }

  return result;
}

/** Recursively mask a field at a dot-notation path. */
function maskFieldPath(
  obj: Record<string, unknown>,
  pathParts: string[],
): void {
  if (pathParts.length === 0 || typeof obj !== "object" || obj === null) return;

  const [head, ...rest] = pathParts;
  if (!head) return;

  if (rest.length === 0) {
    // Terminal node — mask the value
    if (head in obj) {
      obj[head] = "[REDACTED]";
    }
    return;
  }

  const child = obj[head];
  if (Array.isArray(child)) {
    for (const item of child) {
      if (typeof item === "object" && item !== null) {
        maskFieldPath(item as Record<string, unknown>, rest);
      }
    }
  } else if (typeof child === "object" && child !== null) {
    maskFieldPath(child as Record<string, unknown>, rest);
  }
}

/** Simple recursive deep clone for plain JSON objects. */
function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
