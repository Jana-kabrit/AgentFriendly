/**
 * Example API route demonstrating:
 * 1. Reading AgentContext from the middleware-injected header
 * 2. Serving different responses to agents vs humans
 * 3. Tool definition via agentMeta export (auto-registered in the tool manifest)
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import type { ToolDefinition } from "@agentfriendly/next";

/**
 * Exports the tool definition for this route.
 * @agentfriendly picks this up and includes it in the tool manifest at
 * /.well-known/agent-tools.json, /webagents.md, and /.well-known/agent.json.
 */
export const agentMeta: ToolDefinition = {
  tool: "searchProducts",
  description:
    "Search the product catalog by keyword and optional category filter. " +
    "Returns a list of matching products with name, price, and stock status.",
  version: "1.0.0",
  schema: {
    type: "object",
    properties: {
      q: {
        type: "string",
        description: "Search keyword (required)",
        minLength: 1,
        maxLength: 200,
      },
      category: {
        type: "string",
        description: "Filter by category (optional)",
        enum: ["electronics", "clothing", "books", "home"],
      },
      limit: {
        type: "integer",
        description: "Maximum number of results (default: 10, max: 100)",
        minimum: 1,
        maximum: 100,
        default: 10,
      },
    },
    required: ["q"],
  },
  tags: ["catalog", "search", "public"],
};

// Minimal fake product data
const PRODUCTS = [
  { id: "1", name: "Laptop Pro 14", price: 1299, category: "electronics", inStock: true },
  { id: "2", name: "Mechanical Keyboard", price: 149, category: "electronics", inStock: true },
  { id: "3", name: "TypeScript Handbook", price: 49, category: "books", inStock: false },
  { id: "4", name: "Noise-Canceling Headphones", price: 299, category: "electronics", inStock: true },
];

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const category = searchParams.get("category");
  const limit = Number(searchParams.get("limit") ?? "10");

  const results = PRODUCTS.filter((p) => {
    const matchesQuery = q.length === 0 || p.name.toLowerCase().includes(q.toLowerCase());
    const matchesCategory = !category || p.category === category;
    return matchesQuery && matchesCategory;
  }).slice(0, limit);

  // Read agent context injected by the middleware
  const ctxHeader = request.headers.get("x-agentfriendly-context");
  const agentContext = ctxHeader ? JSON.parse(ctxHeader) as { isAgent: boolean; tier: string } : null;

  return NextResponse.json({
    results,
    total: results.length,
    meta: {
      isAgentRequest: agentContext?.isAgent ?? false,
      tier: agentContext?.tier ?? "unknown",
    },
  });
}
