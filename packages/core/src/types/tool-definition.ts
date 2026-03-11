/**
 * A JSON Schema v7 property definition, as used in tool input schemas.
 * We define a subset of JSON Schema v7 that covers the most common use cases
 * and is understood by Claude, GPT, and Gemini function-calling APIs.
 */
export type JsonSchemaType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "object"
  | "array"
  | "null";

/** A JSON Schema v7 property descriptor. */
export interface JsonSchemaProperty {
  readonly type: JsonSchemaType | readonly JsonSchemaType[];
  readonly description?: string;
  readonly default?: unknown;
  readonly enum?: readonly unknown[];
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly format?: string;
  readonly items?: JsonSchemaProperty;
  readonly properties?: Record<string, JsonSchemaProperty>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean | JsonSchemaProperty;
}

/** Full JSON Schema v7 object descriptor for a tool's input. */
export interface ToolInputSchema {
  readonly type: "object";
  readonly properties: Record<string, JsonSchemaProperty>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
}

/**
 * Pricing policy for an individual tool.
 * If omitted, the tool is free to call.
 */
export interface ToolPricingPolicy {
  /** The billing model for this tool. */
  readonly model: "per-request" | "per-token" | "free";
  /**
   * The amount charged per unit.
   * For "per-request": USDC per call.
   * For "per-token": USDC per 1,000 output tokens.
   * Omit for "free".
   */
  readonly amount?: number;
  /** Currency: always "USDC" for x402. Omit for free tools. */
  readonly currency?: "USDC";
}

/**
 * A tool definition registered on a route via `agentMeta`.
 *
 * This single object drives multiple SDK behaviors:
 * - Tool manifest generation (`/agent-tools/v{n}.json`, `/webagents.md`, `agent.json`)
 * - Route-level access control (which trust tiers can call this tool)
 * - Monetization (price and billing model per call)
 * - PII field masking (which response fields are masked for agent responses)
 * - Multi-tenant scoping (whether this tool is scoped to the acting user/tenant)
 * - Tool versioning (schema changelog for backward-compatible agent support)
 */
export interface ToolDefinition {
  /**
   * Stable machine-readable name for this tool.
   * Used as the key in all manifests. Must be camelCase. No spaces or hyphens.
   * Example: "searchProducts", "createWebhook", "exportTransactions"
   */
  readonly tool: string;

  /**
   * Human-readable description of what this tool does.
   * This is the primary text shown to the LLM when deciding whether to call this tool.
   * Write for an LLM audience: be specific about what input produces what output.
   * Example: "Search the product catalog by keyword and optional filters.
   *           Returns a list of matching products with name, price, and availability."
   */
  readonly description: string;

  /**
   * Semantic version of this tool's input schema.
   * Increment the major version when making backward-incompatible schema changes.
   * Old versions are retained in the manifest at /agent-tools/v{n}.json.
   * Default: "1.0.0"
   */
  readonly version?: string;

  /**
   * JSON Schema v7 describing the tool's input parameters.
   * If omitted, the tool accepts no input (e.g., a simple GET endpoint).
   */
  readonly schema?: ToolInputSchema;

  /**
   * Whether this tool is scoped to the authenticated user/tenant.
   * When true, Layer 8 injects the tenant context and the tool can access
   * user-specific data. Requires a valid RFC 8693 delegation token.
   * Default: false
   */
  readonly tenantScoped?: boolean;

  /**
   * Fields in the tool's response that contain PII and should be masked
   * for agent responses. Use dot notation for nested fields.
   * Example: ["user.email", "billingAddress", "phoneNumber"]
   */
  readonly piiFields?: readonly string[];

  /**
   * Monetization policy for this tool.
   * If omitted, the tool is free to call (no x402 challenge).
   */
  readonly pricing?: ToolPricingPolicy;

  /**
   * Minimum trust tier required to call this tool.
   * Default: "known-agent" (verified identity not required).
   * Set to "verified-agent" for sensitive tools.
   */
  readonly minTier?: "known-agent" | "verified-agent";

  /**
   * Tags for organizing tools in manifests and documentation.
   * Example: ["catalog", "search", "public"]
   */
  readonly tags?: readonly string[];
}
