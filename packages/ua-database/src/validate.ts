/**
 * Database validation script — run via `pnpm validate` in the ua-database package.
 * Checks every entry in agents.json against the schema and prints a report.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface ValidationError {
  agentName: string;
  field: string;
  message: string;
}

const REQUIRED_FIELDS = [
  "pattern",
  "matchType",
  "agentName",
  "operator",
  "category",
  "description",
  "verificationSupport",
  "firstSeen",
  "sources",
] as const;

const VALID_MATCH_TYPES = new Set(["exact", "prefix", "regex"]);
const VALID_CATEGORIES = new Set([
  "training-crawler",
  "search-bot",
  "interactive-agent",
  "browser-agent",
]);
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const URL_REGEX = /^https?:\/\/.+/;

export function validateDatabase(): void {
  const dataPath = resolve(__dirname, "../data/agents.json");
  const raw = JSON.parse(readFileSync(dataPath, "utf-8")) as Record<string, unknown>;

  const errors: ValidationError[] = [];
  let warnings = 0;

  console.log(`\n[@agentfriendly/ua-database] Validating agents.json v${String(raw["version"])}\n`);

  if (!raw["version"] || typeof raw["version"] !== "string") {
    console.error("FAIL: Missing or invalid top-level 'version' field");
    process.exit(1);
  }

  if (!raw["lastUpdated"] || !DATE_REGEX.test(String(raw["lastUpdated"]))) {
    console.error("FAIL: Missing or invalid 'lastUpdated' field (expected YYYY-MM-DD)");
    process.exit(1);
  }

  const agents = raw["agents"];
  if (!Array.isArray(agents)) {
    console.error("FAIL: 'agents' must be an array");
    process.exit(1);
  }

  for (const agent of agents) {
    if (typeof agent !== "object" || agent === null) {
      errors.push({ agentName: "(unknown)", field: "root", message: "Entry is not an object" });
      continue;
    }

    const entry = agent as Record<string, unknown>;
    const name = typeof entry["agentName"] === "string" ? entry["agentName"] : "(unknown)";

    // Check required fields
    for (const field of REQUIRED_FIELDS) {
      if (!(field in entry)) {
        errors.push({ agentName: name, field, message: `Missing required field '${field}'` });
      }
    }

    // Validate matchType
    if (entry["matchType"] !== undefined && !VALID_MATCH_TYPES.has(String(entry["matchType"]))) {
      errors.push({
        agentName: name,
        field: "matchType",
        message: `Invalid matchType '${String(entry["matchType"])}'. Must be: exact, prefix, regex`,
      });
    }

    // Validate category
    if (entry["category"] !== undefined && !VALID_CATEGORIES.has(String(entry["category"]))) {
      errors.push({
        agentName: name,
        field: "category",
        message: `Invalid category '${String(entry["category"])}'`,
      });
    }

    // Validate firstSeen date format
    if (entry["firstSeen"] !== undefined && !DATE_REGEX.test(String(entry["firstSeen"]))) {
      errors.push({
        agentName: name,
        field: "firstSeen",
        message: `Invalid date format '${String(entry["firstSeen"])}'. Expected YYYY-MM-DD`,
      });
    }

    // Validate operatorUrl if present
    if (
      entry["operatorUrl"] !== null &&
      entry["operatorUrl"] !== undefined &&
      !URL_REGEX.test(String(entry["operatorUrl"]))
    ) {
      errors.push({
        agentName: name,
        field: "operatorUrl",
        message: `Invalid URL format: '${String(entry["operatorUrl"])}'`,
      });
    }

    // Validate sources array
    if (Array.isArray(entry["sources"])) {
      for (const src of entry["sources"] as unknown[]) {
        if (typeof src !== "string" || !URL_REGEX.test(src)) {
          errors.push({
            agentName: name,
            field: "sources",
            message: `Invalid source URL: '${String(src)}'`,
          });
        }
      }
      // Warn about empty sources (not an error, but worth flagging)
      if ((entry["sources"] as unknown[]).length === 0) {
        console.warn(`  WARN: ${name} has no sources — consider adding a reference URL`);
        warnings++;
      }
    }

    // Validate regex patterns are compilable
    if (entry["matchType"] === "regex" && typeof entry["pattern"] === "string") {
      try {
        new RegExp(entry["pattern"]);
      } catch {
        errors.push({
          agentName: name,
          field: "pattern",
          message: `Invalid regex pattern: '${entry["pattern"]}'`,
        });
      }
    }

    // Warn about very short patterns that may cause false positives
    if (
      typeof entry["pattern"] === "string" &&
      entry["pattern"].length < 5 &&
      entry["matchType"] !== "regex"
    ) {
      console.warn(
        `  WARN: ${name} has a very short pattern '${entry["pattern"]}' — may cause false positives`,
      );
      warnings++;
    }
  }

  // Report results
  if (errors.length === 0) {
    console.log(
      `✅ Validation passed: ${agents.length} agents, ${warnings} warning(s)\n`,
    );
  } else {
    console.error(`❌ Validation failed: ${errors.length} error(s), ${warnings} warning(s)\n`);
    for (const err of errors) {
      console.error(`  [${err.agentName}] ${err.field}: ${err.message}`);
    }
    process.exit(1);
  }
}

// Run validation when called as a script
validateDatabase();
