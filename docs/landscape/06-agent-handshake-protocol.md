# Agent Handshake Protocol (AHP)

## What It Is

The Agent Handshake Protocol (AHP) is an open protocol that defines how AI agents discover and interact with websites through a machine-readable manifest. It was designed as the evolution beyond `llms.txt` — replacing passive document-throwing with a structured contract.

- Website: [agenthandshake.dev](https://agenthandshake.dev)
- Status: Draft 0.1 (active working draft, not finalized)
- License: Open

The tagline: "No scraping. No guessing. A handshake."

## The Problem It Solves

`llms.txt` tells agents what content exists (a document list). Cloudflare Markdown for Agents tells agents how to get clean content (a format). AHP tells agents what the site can **do** — and provides a structured way to interact with it.

A site with `llms.txt` is AHP MODE1 compliant with zero additional changes (just add the manifest). Everything else builds from there.

## Three Progressive Modes

AHP is designed for progressive adoption — you start with MODE1 in an afternoon and upgrade when ready.

### MODE1 — Static Serve

A manifest at `/.well-known/agent.json` that points visiting agents to your content.

**Required**: Zero server logic. Works with static sites.

**Example `/.well-known/agent.json`**:
```json
{
  "ahp": "0.1",
  "modes": ["MODE1"],
  "name": "Checkly",
  "description": "API monitoring and synthetic testing platform",
  "endpoints": {
    "content": "/llms.txt"
  },
  "content_signals": {
    "ai_train": false,
    "ai_input": true,
    "search": true
  }
}
```

**Best for**: Static sites, blogs, portfolios, any site that already has `llms.txt`.

### MODE2 — Interactive Knowledge

Visiting agents ask questions. Your site answers from its content. A `POST /agent/converse` endpoint backed by a knowledge base returns precise, sourced answers.

**Example request**:
```json
POST /agent/converse
{
  "question": "How do I set up a Playwright check?",
  "context": "I want to monitor my login flow"
}
```

**Example response**:
```json
{
  "answer": "To set up a Playwright check in Checkly, navigate to Checks → New Check → Browser Check. You can then write Playwright test code directly in the editor...",
  "sources": ["/docs/browser-checks/getting-started", "/docs/playwright/overview"],
  "confidence": 0.92
}
```

**Why this is powerful**: An agent asking one question gets one precise answer in ~400 tokens. An agent fetching and parsing the relevant docs page gets 180,000 tokens of HTML — or even 500 tokens of markdown, but with content it didn't need.

**Best for**: Documentation sites, knowledge bases, support platforms.

### MODE3 — Agentic Desk

Your site's agent has tools. Visiting agents delegate tasks; your agent handles them and delivers results synchronously or asynchronously.

**The `/.well-known/agent.json` for MODE3**:
```json
{
  "ahp": "0.1",
  "modes": ["MODE1", "MODE2", "MODE3"],
  "endpoints": {
    "content": "/llms.txt",
    "converse": "/agent/converse",
    "task": "/agent/task"
  },
  "tools": [
    {
      "name": "exportData",
      "description": "Export monitoring data for a date range",
      "schema": {
        "type": "object",
        "properties": {
          "startDate": { "type": "string", "format": "date" },
          "endDate": { "type": "string", "format": "date" },
          "format": { "type": "string", "enum": ["csv", "json"] }
        },
        "required": ["startDate", "endDate"]
      }
    }
  ]
}
```

**Task delegation flow**:
```
POST /agent/task
{
  "task": "exportData",
  "args": { "startDate": "2026-01-01", "endDate": "2026-01-31", "format": "csv" },
  "webhook": "https://my-agent.example.com/callbacks/task-complete"
}

→ 202 Accepted
{
  "taskId": "tsk_abc123",
  "statusUrl": "/agent/task/tsk_abc123",
  "estimatedSeconds": 30
}

→ (30 seconds later) POST to webhook:
{
  "taskId": "tsk_abc123",
  "status": "completed",
  "result": { "downloadUrl": "https://...", "rowCount": 14523 }
}
```

**Best for**: Services, e-commerce, support, SaaS platforms where agents need to do things, not just learn things.

## Discovery Mechanisms

AHP meets agents wherever they arrive:

| Method | How it works |
|--------|-------------|
| Well-known URI | `GET /.well-known/agent.json` — direct path for agents that know to look |
| Accept header | Server responds to `Accept: application/agent+json` with the manifest or a redirect |
| In-page notice | `<section class="ahp-notice" aria-label="AI Agent Notice">` visible to headless browsers |

## Relationship to Other Standards

| Standard | What it does | AHP relationship |
|----------|-------------|-----------------|
| `robots.txt` | Access control for crawlers | AHP MODE1 includes `content_signals` that complement robots.txt |
| `llms.txt` | Lists key pages for agents | AHP MODE1 references `llms.txt` as its content endpoint |
| `webagents.md` | Lists JavaScript functions for browser agents | AHP MODE3 is the server-side equivalent |
| WebMCP | Chrome-native tool registration | AHP MODE3 covers the same use case for all HTTP clients |

## How `@agentfriendly` Implements AHP

The SDK auto-generates `/.well-known/agent.json` from your configuration:

- MODE1 is always enabled (manifest + `llms.txt` reference)
- MODE2 is enabled when you configure a knowledge base retriever
- MODE3 is enabled when you register task handlers

The manifest is regenerated at startup and served from memory. Changes to your configuration or registered tools are reflected in the manifest immediately.
