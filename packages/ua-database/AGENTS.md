# Contributing to the Agent UA Database

This file documents how to add new entries to `data/agents.json`. All pull requests that modify `data/agents.json` are validated against the schema automatically in CI.

## When to Add a New Entry

Add a new entry when:
- A new AI company releases a crawler or agent with a documented user-agent string
- An existing agent changes its user-agent string
- Community members observe an undocumented agent in their access logs

Do **not** add entries for:
- Generic HTTP libraries without clear AI agent association (e.g., "curl/7.x")
- Bots that scrape for non-AI purposes (e.g., price comparison bots)

## Required Fields

Every entry must include:

| Field | Type | Description |
|-------|------|-------------|
| `pattern` | string | The user-agent string or pattern to match |
| `matchType` | "exact" \| "prefix" \| "regex" | How to match the pattern |
| `agentName` | string | Human-readable name |
| `operator` | string | Company/organization name |
| `operatorUrl` | string \| null | Operator's website URL |
| `category` | see below | Type of agent |
| `description` | string | Description including notable behaviors |
| `verificationSupport` | boolean | Supports RFC 9421 signing? |
| `firstSeen` | YYYY-MM-DD | First observed date |
| `sources` | string[] | Reference URLs |

## Categories

| Category | When to use |
|----------|------------|
| `training-crawler` | Crawls to collect data for model training. Usually documented by the operator. |
| `search-bot` | Fetches content for real-time search citations. Drives referral traffic. |
| `interactive-agent` | Acts on behalf of a user to complete tasks in real time. |
| `browser-agent` | Headless browser automation framework (not tied to a specific AI company). |

## Match Type Guidelines

- Use **`prefix`** for user-agents that include a version string after a distinctive prefix (e.g., `GPTBot/1.0` → pattern: `GPTBot`)
- Use **`exact`** for user-agents that do not vary and have no version suffix (e.g., `Google-Extended`)
- Use **`regex`** only when the user-agent format is complex and cannot be represented as a prefix (e.g., contains version numbers mid-string)

**Prefer prefix over regex** whenever possible. Regex patterns are slower and harder to maintain.

## Example Entry

```json
{
  "pattern": "NewAIBot",
  "matchType": "prefix",
  "agentName": "NewAIBot",
  "operator": "NewAI Company",
  "operatorUrl": "https://newai.example.com",
  "category": "search-bot",
  "description": "NewAI's search crawler for real-time citations. Sends Accept: text/markdown.",
  "verificationSupport": false,
  "firstSeen": "2026-03-01",
  "sources": [
    "https://newai.example.com/docs/bot",
    "https://darkvisitors.com/agents/newaibot"
  ]
}
```

## Validation

After editing `data/agents.json`, run:

```bash
pnpm --filter @agentfriendly/ua-database validate
```

This will catch any schema violations before you submit a PR.

## Sources

Good sources for discovering new agents:
- [Dark Visitors](https://darkvisitors.com) — regularly updates their agent database
- [Cloudflare Bot Reference](https://developers.cloudflare.com/ai-crawl-control/reference/bots/) — Cloudflare's verified bot list
- Your own access logs — filter for unusual user-agents
- AI company developer documentation — most document their user-agents
