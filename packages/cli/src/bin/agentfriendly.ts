#!/usr/bin/env node
/**
 * @agentfriendly/cli — Main CLI entry point
 *
 * Commands:
 *   init             Interactive setup wizard
 *   validate [url]   Check a site's agent-friendly implementation
 *   test-detection   Simulate detection pipeline for a User-Agent
 *   preview [url]    Preview what an agent sees on a URL
 */

import { resolve } from "node:path";
import { parseArgs } from "node:util";

import pc from "picocolors";

import { runInit } from "../commands/init.js";
import { runPreview } from "../commands/preview.js";
import { runTestDetection } from "../commands/test_detection.js";
import { runValidate } from "../commands/validate.js";
import { header, divider, info } from "../utils/output.js";

const VERSION = "0.1.0";

function printHelp(): void {
  header("AgentFriendly CLI");
  divider();
  console.log(`  ${pc.bold("Usage:")} agentfriendly <command> [options]`);
  divider();
  console.log(`  ${pc.bold("Commands:")}`);
  info(`${pc.cyan("init")}                         Interactive setup wizard`);
  info(
    `${pc.cyan("validate")} [--url <url>]        Validate a site's agent-friendly implementation`,
  );
  info(`${pc.cyan("test-detection")} [--ua <ua>]    Simulate detection pipeline`);
  info(`${pc.cyan("preview")} [--url <url>]         Preview what an agent sees`);
  divider();
  console.log(`  ${pc.bold("Options:")}`);
  info("--help, -h          Show this help message");
  info("--version, -v       Show version");
  divider();
  console.log(`  ${pc.bold("Examples:")}`);
  info("agentfriendly init");
  info("agentfriendly validate --url https://mysite.com");
  info('agentfriendly test-detection --ua "GPTBot/1.0"');
  info("agentfriendly preview --url https://mysite.com");
  divider();
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
      url: { type: "string" },
      ua: { type: "string" },
      accept: { type: "string" },
      framework: { type: "string" },
      force: { type: "boolean" },
      verbose: { type: "boolean" },
    },
    strict: false,
  });

  if (values["version"]) {
    console.log(`@agentfriendly/cli v${VERSION}`);
    return;
  }

  const command = positionals[0];

  if (!command || values["help"]) {
    printHelp();
    return;
  }

  const cwd = resolve(process.cwd());

  switch (command) {
    case "init":
      await runInit(
        {
          framework: values["framework"] as string | undefined,
          force: typeof values["force"] === "boolean" ? values["force"] : undefined,
        },
        cwd,
      );
      break;

    case "validate":
      await runValidate({
        url: typeof values["url"] === "string" ? values["url"] : undefined,
      });
      break;

    case "test-detection":
      await runTestDetection({
        ua: typeof values["ua"] === "string" ? values["ua"] : undefined,
        accept: typeof values["accept"] === "string" ? values["accept"] : undefined,
        verbose: typeof values["verbose"] === "boolean" ? values["verbose"] : undefined,
      });
      break;

    case "preview":
      await runPreview({
        url: typeof values["url"] === "string" ? values["url"] : undefined,
        ua: typeof values["ua"] === "string" ? values["ua"] : undefined,
      });
      break;

    default:
      console.error(`  Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err: Error) => {
  console.error(pc.red("  Fatal error:"), err.message);
  process.exit(1);
});
