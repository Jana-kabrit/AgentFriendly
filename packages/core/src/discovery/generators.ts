import type { LlmsTxtConfig, ContentSignalsConfig } from "../types/config.js";
import type { ToolDefinition } from "../types/tool-definition.js";

/**
 * Layer 1 — Discovery File Generators
 *
 * Generates all agent discovery files from the SDK configuration and registered tools:
 * - /llms.txt            — AI sitemap (llmstxt.org spec)
 * - /.well-known/agent.json — Agent Handshake Protocol manifest (AHP Draft 0.1)
 * - /webagents.md        — In-browser tool manifest (browser-use spec)
 * - /.well-known/agent-tools.json — Full JSON Schema v7 tool definitions
 *
 * All generators produce static strings computed once at startup.
 * The results are cached and served from memory by the discovery router.
 */

// ---------------------------------------------------------------------------
// llms.txt Generator
// ---------------------------------------------------------------------------

export interface LlmsTxtEntry {
  readonly url: string;
  readonly description: string;
  readonly section?: string;
}

export interface LlmsTxtGeneratorOptions {
  readonly siteDomain: string;
  readonly llmsTxtConfig: LlmsTxtConfig;
  readonly toolEntries: LlmsTxtEntry[];
}

/**
 * Generate the content of /llms.txt from configuration and registered routes.
 *
 * The generated file always follows the llmstxt.org spec:
 * - H1 = project name
 * - Blockquote = short summary
 * - Sections with linked pages
 */
export function generateLlmsTxt(options: LlmsTxtGeneratorOptions): string {
  const { siteDomain, llmsTxtConfig, toolEntries } = options;
  const title = llmsTxtConfig.title ?? siteDomain;
  const description =
    llmsTxtConfig.description ?? `${siteDomain} — an agent-friendly web application.`;

  const lines: string[] = [`# ${title}`, ``, `> ${description}`, ``];

  // Group manual entries and auto-discovered tool entries by section
  const allEntries = [...(llmsTxtConfig.manualEntries ?? []), ...toolEntries];

  const sections = new Map<string, LlmsTxtEntry[]>();
  const defaultSection = "API & Tools";

  for (const entry of allEntries) {
    const section = entry.section ?? defaultSection;
    const existing = sections.get(section) ?? [];
    existing.push(entry);
    sections.set(section, existing);
  }

  // Emit each section
  for (const [section, entries] of sections) {
    lines.push(`## ${section}`, ``);
    for (const entry of entries) {
      const url = entry.url.startsWith("http") ? entry.url : `https://${siteDomain}${entry.url}`;
      lines.push(`- [${entry.description}](${url}): ${entry.description}`);
    }
    lines.push(``);
  }

  // Always include the discovery endpoints section
  lines.push(
    `## Agent Discovery`,
    ``,
    `- [Agent Manifest](https://${siteDomain}/.well-known/agent.json): Agent Handshake Protocol manifest`,
    `- [Tool Definitions](https://${siteDomain}/.well-known/agent-tools.json): Full JSON Schema v7 tool definitions`,
    `- [In-Browser Tools](https://${siteDomain}/webagents.md): JavaScript tool manifest for browser-based agents`,
    ``,
  );

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// agent.json Generator (AHP Manifest)
// ---------------------------------------------------------------------------

export interface AgentJsonOptions {
  readonly siteDomain: string;
  readonly siteName: string;
  readonly siteDescription: string;
  readonly tools: readonly ToolDefinition[];
  readonly contentSignals?: ContentSignalsConfig;
  readonly hasConverseEndpoint: boolean;
  readonly hasTaskHandlers: boolean;
  readonly toolsBasePath: string;
}

/**
 * Generate the AHP manifest at /.well-known/agent.json.
 *
 * The manifest declares what modes the site supports:
 * - MODE1: always present (static content + llms.txt reference)
 * - MODE2: present when converseEndpoint is configured
 * - MODE3: present when task handlers are registered
 */
export function generateAgentJson(options: AgentJsonOptions): string {
  const {
    siteDomain,
    siteName,
    siteDescription,
    tools,
    contentSignals,
    hasConverseEndpoint,
    hasTaskHandlers,
    toolsBasePath,
  } = options;

  const modes = ["MODE1"];
  const endpoints: Record<string, string> = {
    content: `https://${siteDomain}/llms.txt`,
    tools: `https://${siteDomain}/.well-known/agent-tools.json`,
  };

  if (hasConverseEndpoint) {
    modes.push("MODE2");
    endpoints["converse"] = `https://${siteDomain}${toolsBasePath}/converse`;
  }

  if (hasTaskHandlers) {
    modes.push("MODE3");
    endpoints["task"] = `https://${siteDomain}${toolsBasePath}/task`;
  }

  const manifest: Record<string, unknown> = {
    ahp: "0.1",
    modes,
    name: siteName,
    description: siteDescription,
    endpoints,
    content_signals: {
      ai_train: contentSignals?.["ai-train"] ?? false,
      ai_input: contentSignals?.["ai-input"] ?? true,
      search: contentSignals?.["search"] ?? true,
    },
  };

  // Include tool summaries in the manifest (full schemas are in agent-tools.json)
  if (tools.length > 0) {
    manifest["tools"] = tools.map((tool) => ({
      name: tool.tool,
      description: tool.description,
      version: tool.version ?? "1.0.0",
      tags: tool.tags ?? [],
      ...(tool.pricing ? { pricing: tool.pricing } : {}),
    }));
  }

  return JSON.stringify(manifest, null, 2);
}

// ---------------------------------------------------------------------------
// webagents.md Generator
// ---------------------------------------------------------------------------

/**
 * Generate the /webagents.md manifest from registered tools.
 *
 * This is a markdown file listing TypeScript function signatures.
 * Browser-based agents (browser-use, Playwright frameworks) parse this
 * and generate TypeScript declarations that LLMs use to write calling code.
 */
export function generateWebagentsMd(tools: readonly ToolDefinition[]): string {
  if (tools.length === 0) {
    return `# Agent Tools\n\nNo tools are currently registered.\n`;
  }

  const lines: string[] = [
    `# Agent Tools`,
    ``,
    `This page lists all functions available to AI agents interacting with this site.`,
    `To call a function, use: \`await global.<functionName>(args)\``,
    ``,
  ];

  for (const tool of tools) {
    lines.push(`## ${tool.tool}`, ``);
    lines.push(tool.description, ``);

    // Generate TypeScript function signature from the JSON Schema
    const params = tool.schema?.properties
      ? buildTypescriptParams(tool.schema.properties, tool.schema.required)
      : "";

    const returnType = "Promise<unknown>";

    lines.push("```typescript");
    lines.push(`async function ${tool.tool}(${params}): ${returnType}`);
    lines.push("```", ``);

    // Add parameter descriptions as a table if there are parameters
    if (tool.schema?.properties && Object.keys(tool.schema.properties).length > 0) {
      lines.push("**Parameters:**", ``);
      lines.push("| Parameter | Type | Required | Description |");
      lines.push("|-----------|------|----------|-------------|");
      for (const [name, prop] of Object.entries(tool.schema.properties)) {
        const isRequired = tool.schema.required?.includes(name) ?? false;
        const rawType = prop.type;
        const type = Array.isArray(rawType) ? [...rawType].join(" | ") : (rawType ?? "unknown");
        const description = prop.description ?? "";
        lines.push(`| \`${name}\` | \`${type}\` | ${isRequired ? "Yes" : "No"} | ${description} |`);
      }
      lines.push(``);
    }

    if (tool.version) {
      lines.push(`*Version: ${tool.version}*`, ``);
    }
  }

  return lines.join("\n");
}

/**
 * Convert a JSON Schema properties object into a TypeScript parameter list string.
 */
function buildTypescriptParams(
  properties: Record<string, { type?: string | readonly string[]; description?: string }>,
  required?: readonly string[],
): string {
  const params = Object.entries(properties).map(([name, prop]) => {
    const isRequired = required?.includes(name) ?? false;
    const tsType = jsonTypeToTs(
      Array.isArray(prop.type) ? (prop.type[0] ?? "unknown") : (prop.type ?? "unknown"),
    );
    return `${name}${isRequired ? "" : "?"}: ${tsType}`;
  });

  // If there are many parameters, wrap in an options object
  if (params.length > 3) {
    return `options: { ${params.join("; ")} }`;
  }
  return params.join(", ");
}

function jsonTypeToTs(jsonType: string): string {
  switch (jsonType) {
    case "string":
      return "string";
    case "number":
    case "integer":
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      return "unknown[]";
    case "object":
      return "Record<string, unknown>";
    case "null":
      return "null";
    default:
      return "unknown";
  }
}

// ---------------------------------------------------------------------------
// agent-tools.json Generator (Full JSON Schema v7)
// ---------------------------------------------------------------------------

/**
 * Generate the /.well-known/agent-tools.json manifest.
 * This is the full JSON Schema v7 tool definitions file, parsed by AI systems
 * to understand exactly what tools are available and how to call them.
 */
export function generateAgentToolsJson(
  tools: readonly ToolDefinition[],
  siteDomain: string,
): string {
  const toolsMap: Record<string, unknown> = {};

  for (const tool of tools) {
    toolsMap[tool.tool] = {
      name: tool.tool,
      description: tool.description,
      version: tool.version ?? "1.0.0",
      inputSchema: tool.schema
        ? {
            $schema: "http://json-schema.org/draft-07/schema#",
            ...tool.schema,
          }
        : null,
      pricing: tool.pricing ?? null,
      minTier: tool.minTier ?? "known-agent",
      tenantScoped: tool.tenantScoped ?? false,
      tags: tool.tags ?? [],
    };
  }

  const manifest = {
    $schema: "https://agentfriendly.dev/schemas/agent-tools.json",
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    site: `https://${siteDomain}`,
    tools: toolsMap,
  };

  return JSON.stringify(manifest, null, 2);
}
