import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { AgentDatabase, AgentEntry, UaMatch } from "./types.js";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Internal index structures built from the database for fast lookups.
 * Built once at module load time; all lookups are O(1) or O(n) on regexes only.
 */
interface DatabaseIndex {
  readonly exactMap: ReadonlyMap<string, AgentEntry>;
  readonly prefixEntries: ReadonlyArray<{ prefix: string; entry: AgentEntry }>;
  readonly regexEntries: ReadonlyArray<{ regex: RegExp; entry: AgentEntry }>;
}

let _database: AgentDatabase | null = null;
let _index: DatabaseIndex | null = null;

/**
 * Load and validate the agents.json database. Called once; result is cached.
 * The database is loaded from the package's data/ directory.
 */
function loadDatabase(): AgentDatabase {
  if (_database) return _database;

  // Load from the data directory, relative to this file's location
  const dataPath = resolve(__dirname, "../data/agents.json");
  const raw: unknown = require(dataPath);

  // Basic structural validation at runtime
  if (
    typeof raw !== "object" ||
    raw === null ||
    !("agents" in raw) ||
    !Array.isArray((raw as Record<string, unknown>)["agents"])
  ) {
    throw new Error(
      `[@agentfriendly/ua-database] Invalid agents.json: missing required "agents" array`,
    );
  }

  _database = raw as AgentDatabase;
  return _database;
}

/**
 * Build lookup indexes from the database for fast matching.
 * Separates entries by match type so lookups avoid unnecessary comparisons.
 */
function buildIndex(db: AgentDatabase): DatabaseIndex {
  if (_index) return _index;

  const exactMap = new Map<string, AgentEntry>();
  const prefixEntries: Array<{ prefix: string; entry: AgentEntry }> = [];
  const regexEntries: Array<{ regex: RegExp; entry: AgentEntry }> = [];

  for (const entry of db.agents) {
    switch (entry.matchType) {
      case "exact":
        exactMap.set(entry.pattern, entry);
        break;
      case "prefix":
        prefixEntries.push({ prefix: entry.pattern, entry });
        break;
      case "regex":
        try {
          regexEntries.push({ regex: new RegExp(entry.pattern), entry });
        } catch {
          console.warn(
            `[@agentfriendly/ua-database] Invalid regex pattern "${entry.pattern}" for agent "${entry.agentName}" — skipping`,
          );
        }
        break;
    }
  }

  // Sort prefix entries by length descending so longer (more specific) prefixes match first
  prefixEntries.sort((a, b) => b.prefix.length - a.prefix.length);

  _index = {
    exactMap,
    prefixEntries,
    regexEntries,
  };

  return _index;
}

/**
 * Low-confidence patterns are ones that are very common in general HTTP clients
 * and are not distinctive to AI agents. A match on these is informative but
 * should not alone be considered a definitive agent identification.
 */
const LOW_CONFIDENCE_PREFIXES = new Set(["python-requests/", "python-httpx/", "Scrapy/"]);

/**
 * Match a User-Agent string against the database.
 *
 * Matching order:
 * 1. Exact match (O(1) hash lookup)
 * 2. Prefix match (O(n) on prefix entries, sorted by specificity)
 * 3. Regex match (O(n) on regex entries, only if no prior match)
 *
 * Returns the first match found, or null if no match.
 */
export function matchUserAgent(userAgent: string): UaMatch | null {
  if (!userAgent || userAgent.trim().length === 0) return null;

  const db = loadDatabase();
  const index = buildIndex(db);

  // 1. Exact match (fastest)
  const exactEntry = index.exactMap.get(userAgent);
  if (exactEntry) {
    return { entry: exactEntry, confidence: "high" };
  }

  // 2. Prefix match (sorted by descending length = most specific first)
  for (const { prefix, entry } of index.prefixEntries) {
    if (userAgent.startsWith(prefix)) {
      const confidence = LOW_CONFIDENCE_PREFIXES.has(prefix) ? "medium" : "high";
      return { entry, confidence };
    }
  }

  // 3. Regex match (least preferred — use only for complex patterns)
  for (const { regex, entry } of index.regexEntries) {
    if (regex.test(userAgent)) {
      return { entry, confidence: "medium" };
    }
  }

  return null;
}

/**
 * Return all entries in the database.
 * Useful for generating robots.txt directives or listing known agents.
 */
export function getAllAgents(): readonly AgentEntry[] {
  return loadDatabase().agents;
}

/**
 * Return the database version string.
 */
export function getDatabaseVersion(): string {
  return loadDatabase().version;
}

/**
 * Return all agents of a specific category.
 */
export function getAgentsByCategory(
  category: AgentEntry["category"],
): readonly AgentEntry[] {
  return loadDatabase().agents.filter((a) => a.category === category);
}

/**
 * Clear the module-level cache. Only needed in tests.
 * @internal
 */
export function _clearCache(): void {
  _database = null;
  _index = null;
}
