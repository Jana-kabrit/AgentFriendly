/**
 * Framework-agnostic representation of an HTTP response produced by the core pipeline.
 *
 * Framework adapters translate this into their native response type
 * (NextResponse, Express Response, Hono Response, etc.).
 *
 * The "passthrough" flag (handled: false) tells the adapter that the core pipeline
 * is not serving this response — the request should continue to the normal route handler.
 * This is the common case for human visitors and non-intercepted agent requests.
 */

/** A response the core pipeline is fully serving (overrides the route handler). */
export interface HandledResponse {
  readonly handled: true;
  /** HTTP status code. */
  readonly status: number;
  /**
   * Response headers to set. These are merged with (and may override) any headers
   * the route handler would have set.
   */
  readonly headers: Record<string, string>;
  /** Response body. String, Buffer, or null for no body (e.g., 204, 304). */
  readonly body: string | Buffer | null;
  /** Content-Type of the body (e.g., "text/markdown", "application/json"). */
  readonly contentType: string;
}

/** The core pipeline is not serving this response — the request passes through to the route handler. */
export interface PassthroughResponse {
  readonly handled: false;
  /**
   * Headers to inject into the eventual response, even though the route handler serves it.
   * Used to add Content-Signal headers, debug headers, x-markdown-tokens, etc.
   */
  readonly injectHeaders: Record<string, string>;
}

/** Discriminated union of all possible pipeline response types. */
export type AgentResponse = HandledResponse | PassthroughResponse;
