/**
 * Example API route demonstrating:
 * 1. Reading AgentContext from the middleware-injected header
 * 2. Serving different responses to agents vs humans
 *
 * Note: Next.js 15 rejects custom route exports (e.g. agentMeta for tool registration).
 * Tool manifests would require config-based registration (see SDK docs).
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
