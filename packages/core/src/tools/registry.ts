import { meetsMinimumTier } from "../access/policy-engine.js";

import type { AgentContext } from "../types/agent-context.js";
import type { ToolDefinition } from "../types/tool-definition.js";
import type { TrustTier } from "../types/trust-tier.js";

/**
 * Layer 6 — Tool Registry
 *
 * The central store for all registered tools and their handlers.
 * Tools are registered by route handlers (via `agentMeta` exports) or
 * programmatically via `registerTool()`.
 *
 * The registry serves two functions:
 * 1. Providing tool definitions to discovery generators (Layer 1)
 *    for llms.txt, agent.json, webagents.md, and agent-tools.json generation.
 * 2. Routing incoming tool calls (AHP MODE2/MODE3) to the correct handler.
 *
 * Tool versioning:
 * Each tool can have multiple versions. The registry stores all versions and
 * routes calls to the correct version based on the request. Old versions
 * remain callable until explicitly removed.
 */

/** A tool handler function — the actual implementation called when the tool is invoked. */
export type ToolHandler<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown,
> = (input: TInput, context: AgentContext) => Promise<TOutput>;

/** A registered tool entry in the registry. */
export interface RegisteredTool {
  readonly definition: ToolDefinition;
  readonly handler: ToolHandler;
  /** Timestamp of when this tool was registered, used for ordering in discovery files. */
  readonly registeredAt: number;
}

/** Task handler — for AHP MODE3 async task execution. */
export interface TaskHandlerDefinition {
  readonly name: string;
  readonly description: string;
  readonly schema?: ToolDefinition["schema"];
  readonly handler: (
    payload: Record<string, unknown>,
    context: AgentContext,
  ) => Promise<Record<string, unknown>>;
}

export class ToolRegistry {
  /** Maps tool name → version → registered tool entry. */
  private readonly tools = new Map<string, Map<string, RegisteredTool>>();

  /** Maps task name → task handler definition. */
  private readonly tasks = new Map<string, TaskHandlerDefinition>();

  /**
   * Register a tool with its handler.
   * If a tool with the same name and version already exists, it is replaced.
   */
  register(definition: ToolDefinition, handler: ToolHandler): void {
    const version = definition.version ?? "1.0.0";
    const existing = this.tools.get(definition.tool);
    if (existing) {
      existing.set(version, { definition, handler, registeredAt: Date.now() });
    } else {
      const versionMap = new Map<string, RegisteredTool>();
      versionMap.set(version, { definition, handler, registeredAt: Date.now() });
      this.tools.set(definition.tool, versionMap);
    }
  }

  /**
   * Register a task handler for AHP MODE3.
   */
  registerTask(task: TaskHandlerDefinition): void {
    this.tasks.set(task.name, task);
  }

  /**
   * Look up a tool by name, optionally at a specific version.
   * If no version is specified, the latest (highest semver) is returned.
   * Returns null if the tool is not registered.
   */
  getTool(name: string, version?: string): RegisteredTool | null {
    const versionMap = this.tools.get(name);
    if (!versionMap) return null;

    if (version) {
      return versionMap.get(version) ?? null;
    }

    // Return the latest version by semver ordering
    const versions = [...versionMap.keys()];
    const latest = versions.sort(compareSemver).at(-1);
    return latest ? (versionMap.get(latest) ?? null) : null;
  }

  /**
   * Get all registered task handlers.
   */
  getAllTasks(): readonly TaskHandlerDefinition[] {
    return [...this.tasks.values()];
  }

  /**
   * Get a task handler by name.
   */
  getTask(name: string): TaskHandlerDefinition | null {
    return this.tasks.get(name) ?? null;
  }

  /**
   * Get all latest versions of all registered tools.
   * Used by discovery generators to build manifests.
   */
  getAllTools(): readonly ToolDefinition[] {
    const result: ToolDefinition[] = [];
    for (const [, versionMap] of this.tools) {
      const versions = [...versionMap.keys()].sort(compareSemver);
      const latest = versions.at(-1);
      if (latest) {
        const tool = versionMap.get(latest);
        if (tool) result.push(tool.definition);
      }
    }
    return result.sort((a, b) => {
      const aTs = this.tools.get(a.tool)?.get(a.version ?? "1.0.0")?.registeredAt ?? 0;
      const bTs = this.tools.get(b.tool)?.get(b.version ?? "1.0.0")?.registeredAt ?? 0;
      return aTs - bTs;
    });
  }

  /**
   * Get all versions of a specific tool.
   * Returns an empty array if the tool is not registered.
   */
  getToolVersions(name: string): string[] {
    return [...(this.tools.get(name)?.keys() ?? [])].sort(compareSemver);
  }

  /**
   * Invoke a tool, enforcing access control (tier check) before calling the handler.
   */
  async invokeTool(
    name: string,
    input: Record<string, unknown>,
    context: AgentContext,
    version?: string,
  ): Promise<
    | { success: true; output: unknown }
    | { success: false; error: string; statusCode: 400 | 403 | 404 }
  > {
    const tool = this.getTool(name, version);

    if (!tool) {
      return { success: false, error: `Tool "${name}" not found`, statusCode: 404 };
    }

    const requiredTier: TrustTier = tool.definition.minTier ?? "known-agent";
    if (!meetsMinimumTier(context.tier, requiredTier)) {
      return {
        success: false,
        error: `Tool "${name}" requires trust tier "${requiredTier}". Current tier: "${context.tier}"`,
        statusCode: 403,
      };
    }

    // Tenant scoping check: if the tool requires tenant context but none is present
    if (tool.definition.tenantScoped && !context.tenantContext) {
      return {
        success: false,
        error: `Tool "${name}" requires a valid agent delegation token (RFC 8693). No tenant context is present.`,
        statusCode: 403,
      };
    }

    try {
      const output = await tool.handler(input, context);
      return { success: true, output };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        statusCode: 400,
      };
    }
  }

  /**
   * Clear all registered tools and tasks. Only for tests.
   */
  clear(): void {
    this.tools.clear();
    this.tasks.clear();
  }
}

/**
 * Compare two semantic version strings for sorting.
 * Returns negative if a < b, 0 if equal, positive if a > b.
 */
function compareSemver(a: string, b: string): number {
  const parseParts = (v: string): number[] => v.split(".").map((p) => Number.parseInt(p, 10));

  const [aMajor = 0, aMinor = 0, aPatch = 0] = parseParts(a);
  const [bMajor = 0, bMinor = 0, bPatch = 0] = parseParts(b);

  return aMajor !== bMajor
    ? aMajor - bMajor
    : aMinor !== bMinor
      ? aMinor - bMinor
      : aPatch - bPatch;
}
