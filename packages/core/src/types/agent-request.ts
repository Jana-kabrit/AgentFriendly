/**
 * Framework-agnostic representation of an incoming HTTP request.
 *
 * Framework adapters translate their native request objects into this shape
 * before passing to the core pipeline. The core never imports framework types.
 *
 * Design principle: AgentRequest is a simple data object. No methods.
 * Any parsing (query strings, body deserialization) happens in the adapter layer.
 */
export interface AgentRequest {
  /** HTTP method, uppercase (e.g., "GET", "POST"). */
  readonly method: string;
  /** Full URL including origin and query string (e.g., "https://example.com/api/search?q=shoes"). */
  readonly url: string;
  /** URL pathname only (e.g., "/api/search"). Normalized: no trailing slash, preserves case. */
  readonly path: string;
  /**
   * All request headers as a plain object with lowercase keys.
   * Multiple values for the same header are joined with ", ".
   */
  readonly headers: Readonly<Record<string, string>>;
  /**
   * Raw request body as a string, or null for requests with no body.
   * Deserialization (JSON.parse, form parsing) is done by the layer that needs the data.
   */
  readonly body: string | null;
  /**
   * Parsed query string parameters.
   * Values are always strings (no coercion). Arrays for repeated keys use the last value.
   */
  readonly query: Readonly<Record<string, string>>;
  /**
   * IP address of the request origin.
   * May be a proxy IP if behind a load balancer. Used for rate limiting.
   */
  readonly ip: string | null;
}
