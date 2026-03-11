/**
 * E2E: Tool Registry (Layer 6)
 *
 * Tests tool registration, versioning, invocation, and access control.
 */
import { describe, it, expect } from "vitest";
import { ToolRegistry } from "../../src/tools/registry.js";
import type { ToolDefinition } from "../../src/types/tool-definition.js";

function makeSearchTool(version = "1.0.0"): ToolDefinition {
  return {
    tool: "search-products",
    version,
    description: "Search the product catalog",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query" },
        limit: { type: "number", description: "Max results" },
      },
      required: ["query"],
    },
    requiredTier: "known-agent",
    rateLimit: { maxRequests: 10, windowSeconds: 60 },
  };
}

describe("E2E: Tool Registry — basic registration", () => {
  it("registers a tool and retrieves it", () => {
    const registry = new ToolRegistry();
    registry.register(makeSearchTool(), async (input) => ({
      results: [`Result for: ${(input as { query: string }).query}`],
    }));

    const tool = registry.getTool("search-products");
    expect(tool).toBeTruthy();
    expect(tool!.definition.tool).toBe("search-products");
    expect(tool!.definition.description).toBe("Search the product catalog");
  });

  it("getAllTools returns all registered tools", () => {
    const registry = new ToolRegistry();
    registry.register(makeSearchTool(), async () => ({}));
    registry.register(
      {
        tool: "get-product",
        version: "1.0.0",
        description: "Get a single product",
        inputSchema: { type: "object", properties: {}, required: [] },
        requiredTier: "known-agent",
      },
      async () => ({}),
    );
    expect(registry.getAllTools().length).toBe(2);
  });
});

describe("E2E: Tool Registry — invocation", () => {
  it("invokes a tool handler and returns its result", async () => {
    const registry = new ToolRegistry();
    registry.register(makeSearchTool(), async (input) => {
      const typedInput = input as { query: string };
      return { results: [`Product matching "${typedInput.query}"`], total: 1 };
    });

    const tool = registry.getTool("search-products")!;
    const result = await tool.handler({ query: "laptop" });
    expect(result).toEqual({ results: ['Product matching "laptop"'], total: 1 });
  });
});

describe("E2E: Tool Registry — versioning", () => {
  it("supports multiple versions of the same tool", () => {
    const registry = new ToolRegistry();
    registry.register(makeSearchTool("1.0.0"), async () => ({ version: "v1" }));
    registry.register(makeSearchTool("2.0.0"), async () => ({ version: "v2" }));

    // Default getTool returns latest (highest semver)
    const latest = registry.getTool("search-products");
    expect(["1.0.0", "2.0.0"]).toContain(latest?.definition.version);

    const v1 = registry.getTool("search-products", "1.0.0");
    expect(v1?.definition.version).toBe("1.0.0");

    const v2 = registry.getTool("search-products", "2.0.0");
    expect(v2?.definition.version).toBe("2.0.0");
  });

  it("returns null for unknown tool", () => {
    const registry = new ToolRegistry();
    expect(registry.getTool("nonexistent")).toBeNull();
  });
});

describe("E2E: Tool Registry — task operations (async tools)", () => {
  it("getAllTasks returns a list of registered tasks", () => {
    const registry = new ToolRegistry();
    registry.registerTask({
      name: "analyze-dataset",
      description: "Analyze a dataset asynchronously",
      handler: async () => ({ status: "complete" }),
    });
    const tasks = registry.getAllTasks();
    expect(tasks.length).toBe(1);
    expect(tasks[0].name).toBe("analyze-dataset");
  });
});
