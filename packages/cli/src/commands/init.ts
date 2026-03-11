/**
 * `agentfriendly init` — Interactive setup wizard
 *
 * Detects the project framework (Next.js, Express, Hono, Nuxt, Astro)
 * and writes a ready-to-use configuration file.
 */
import { confirm, select, input } from "@inquirer/prompts";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { header, success, warn, info, divider, error } from "../utils/output.js";

type Framework = "next" | "express" | "hono" | "nuxt" | "astro";

interface InitOptions {
  framework?: string | undefined;
  force?: boolean | undefined;
}

async function detectFramework(cwd: string): Promise<Framework | null> {
  try {
    const pkgPath = join(cwd, "package.json");
    if (!existsSync(pkgPath)) return null;
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as Record<
      string,
      Record<string, string>
    >;
    const deps = {
      ...(pkg["dependencies"] ?? {}),
      ...(pkg["devDependencies"] ?? {}),
    };
    if ("next" in deps) return "next";
    if ("nuxt" in deps) return "nuxt";
    if ("astro" in deps) return "astro";
    if ("hono" in deps) return "hono";
    if ("express" in deps) return "express";
  } catch {
    /* ignored */
  }
  return null;
}

const CONFIG_TEMPLATES: Record<Framework, string> = {
  next: `import { createAgentFriendlyMiddleware } from "@agentfriendly/next";

const agentFriendly = createAgentFriendlyMiddleware({
  detection: { proactiveMarkdown: "known" },
  content: {
    markdown: true,
    signals: { "ai-train": false, "ai-input": true, search: true },
  },
  access: {
    // Uncomment to block training crawlers
    // agentTypes: { "training-crawler": "deny-all" },
    deny: [],
  },
});

export default agentFriendly;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
`,
  express: `import express from "express";
import { createAgentFriendlyMiddleware } from "@agentfriendly/express";

const app = express();

app.use(
  createAgentFriendlyMiddleware({
    detection: { proactiveMarkdown: "known" },
    content: {
      markdown: true,
      signals: { "ai-train": false, "ai-input": true, search: true },
    },
  }),
);
`,
  hono: `import { Hono } from "hono";
import { createAgentFriendlyMiddleware } from "@agentfriendly/hono";

const app = new Hono();

app.use(
  "*",
  createAgentFriendlyMiddleware({
    detection: { proactiveMarkdown: "known" },
    content: { markdown: true },
  }),
);
`,
  nuxt: `// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["@agentfriendly/nuxt"],
  agentFriendly: {
    detection: { proactiveMarkdown: "known" },
    content: {
      markdown: true,
      signals: { "ai-train": false, "ai-input": true, search: true },
    },
    access: {
      deny: [],
    },
  },
});
`,
  astro: `// src/middleware.ts
import { createAgentFriendlyMiddleware } from "@agentfriendly/astro";

export const onRequest = createAgentFriendlyMiddleware({
  detection: { proactiveMarkdown: "known" },
  content: {
    markdown: true,
    signals: { "ai-train": false, "ai-input": true, search: true },
  },
});
`,
};

const OUTPUT_FILES: Record<Framework, string> = {
  next: "middleware.ts",
  express: "src/middleware.ts",
  hono: "src/middleware.ts",
  nuxt: "nuxt.config.ts",
  astro: "src/middleware.ts",
};

export async function runInit(options: InitOptions, cwd: string): Promise<void> {
  header("AgentFriendly Setup Wizard");
  divider();

  // 1. Framework detection
  const detectedFramework = await detectFramework(cwd);

  let framework: Framework;

  if (options.framework && Object.keys(CONFIG_TEMPLATES).includes(options.framework)) {
    framework = options.framework as Framework;
    info(`Using specified framework: ${framework}`);
  } else if (detectedFramework) {
    info(`Detected framework: ${detectedFramework}`);
    const confirmed = await confirm({
      message: `Use ${detectedFramework} configuration?`,
      default: true,
    });
    framework = confirmed
      ? detectedFramework
      : ((await select({
          message: "Choose your framework:",
          choices: [
            { value: "next", name: "Next.js" },
            { value: "express", name: "Express.js" },
            { value: "hono", name: "Hono (Cloudflare Workers)" },
            { value: "nuxt", name: "Nuxt 3" },
            { value: "astro", name: "Astro" },
          ],
        })) as Framework);
  } else {
    framework = (await select({
      message: "Choose your framework:",
      choices: [
        { value: "next", name: "Next.js" },
        { value: "express", name: "Express.js" },
        { value: "hono", name: "Hono (Cloudflare Workers)" },
        { value: "nuxt", name: "Nuxt 3" },
        { value: "astro", name: "Astro" },
      ],
    })) as Framework;
  }

  // 2. Proactive markdown strategy
  const proactiveMarkdown = await select<string>({
    message: "When should markdown be served proactively (without explicit Accept header)?",
    choices: [
      { value: "known", name: 'Known agents (GPTBot, Claude, etc.) — recommended' },
      { value: "suspected", name: "Suspected agents too (based on header heuristics)" },
      { value: "verified", name: "Cryptographically verified agents only" },
      { value: "false", name: "Only when agent explicitly requests markdown" },
    ],
    default: "known",
  });

  // 3. Training crawler policy
  const denyTrainers = await confirm({
    message: "Block training crawlers (GPTBot, ClaudeBot, etc.) from your site?",
    default: false,
  });

  // 4. monetization
  const enableMonetization = await confirm({
    message: "Enable x402 micropayments for agent access? (requires a crypto wallet)",
    default: false,
  });

  let walletAddress: string | null = null;
  if (enableMonetization) {
    walletAddress = await input({
      message: "Enter your USDC wallet address (Base network):",
    });
  }

  // 5. Write config
  const outputFile = OUTPUT_FILES[framework];
  const outputPath = join(cwd, outputFile);

  if (existsSync(outputPath) && !options.force) {
    const overwrite = await confirm({
      message: `${outputFile} already exists. Overwrite?`,
      default: false,
    });
    if (!overwrite) {
      warn("Aborted — existing file not overwritten.");
      return;
    }
  }

  let config = CONFIG_TEMPLATES[framework];

  // Patch proactive markdown
  config = config.replace(
    `proactiveMarkdown: "known"`,
    proactiveMarkdown === "false"
      ? "proactiveMarkdown: false"
      : `proactiveMarkdown: "${proactiveMarkdown}"`,
  );

  // Patch training crawler deny
  if (denyTrainers) {
    config = config.replace(
      `// agentTypes: { "training-crawler": "deny-all" },`,
      `agentTypes: { "training-crawler": "deny-all" },`,
    );
  }

  // Patch monetization
  if (enableMonetization && walletAddress) {
    const monetizationBlock = `
  monetization: {
    enabled: true,
    walletAddress: "${walletAddress}",
    network: "base-mainnet",
    routes: {
      // Example: charge $0.001 USDC per /api/** call
      // "/api/**": { price: "0.001" },
    },
  },`;
    config = config.replace(/},\n};$/, `},${monetizationBlock}\n};`);
  }

  writeFileSync(outputPath, config, "utf-8");

  divider();
  success(`Configuration written to ${outputFile}`);

  // Package install hint
  const pkgName = `@agentfriendly/${framework}`;
  info(`Run: pnpm add ${pkgName}    (or npm install / yarn add)`);

  divider();
  info("Next steps:");
  info(`  1. Review ${outputFile} and adjust rules for your site`);
  info("  2. Run: agentfriendly validate   to check for issues");
  info("  3. Run: agentfriendly preview    to preview what agents see");
  divider();
}
