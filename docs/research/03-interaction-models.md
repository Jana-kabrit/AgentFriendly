# Agent Interaction Models

This document explains the three distinct models through which agents can interact with a website using the `@agentfriendly` SDK. Each model is progressively richer in capability.

---

## Model A — Read-Only (Content Negotiation)

**What it is**: The agent fetches a URL and receives clean, structured text instead of HTML.

**How it works**:
1. Agent sends `GET /docs/getting-started` with `Accept: text/markdown, text/html, */*`
2. SDK middleware detects the markdown preference (via Accept header or trust tier)
3. SDK fetches the underlying HTML response, strips navigation/ads/boilerplate using `@mozilla/readability`, converts the main content to markdown using `turndown`
4. SDK responds with `Content-Type: text/markdown`, a `Content-Signal` header declaring usage permissions, and an `x-markdown-tokens` header with the estimated token count
5. Agent receives 478 tokens of clean content instead of 180,573 tokens of HTML

**What it covers**: Documentation pages, blog posts, knowledge bases, product descriptions, pricing pages, any read-only content.

**Who already does it**: Vercel, Checkly, Cloudflare (at CDN level).

**SDK configuration**:
```typescript
// agentfriendly.config.ts
export default {
  content: {
    markdown: true,
    signals: { "ai-train": false, "ai-input": true, "search": true },
  },
  detection: {
    proactiveMarkdown: "known", // serve markdown even without Accept header
  },
}
```

---

## Model B — Action Invocation (webagents.md + AHP MODE2)

**What it is**: The agent calls declared functions that execute on the server or in-browser, allowing it to search, submit forms, query databases, and trigger actions.

**How it works (webagents.md)**:
1. Agent framework (browser-use, or any Playwright-based agent) discovers `<meta name="webagents-md" content="/webagents.md">` in the page source
2. Agent fetches `/webagents.md` — a markdown file listing available JavaScript functions with their signatures and descriptions
3. SDK's webagents runtime converts the manifest into TypeScript type declarations
4. The LLM receives these type declarations as context and writes code: `await global.searchProducts("red shoes", { limit: 10 })`
5. The code executes in the browser via Playwright, calling the actual JavaScript function registered on the page
6. Multiple function calls can be chained in a single execution without round-trips

**How it works (AHP MODE2 — POST /agent/converse)**:
1. Agent discovers `/.well-known/agent.json` and finds `"modes": ["MODE2"]` with `"endpoints": { "converse": "/agent/converse" }`
2. Agent sends: `POST /agent/converse` with body `{ "question": "How do I set up a webhook?" }`
3. SDK routes the request to the converse endpoint, which queries the registered knowledge base (llms.txt-linked pages, or a custom retriever)
4. Response: `{ "answer": "To set up a webhook, navigate to...", "sources": ["/docs/webhooks"] }`
5. Agent receives a precise answer in a fraction of the tokens compared to fetching and parsing a full page

**What it covers**: Product catalog search, form submission, knowledge base Q&A, data queries, user-initiated actions.

**SDK configuration**:
```typescript
// A route handler with tool registration
// app/api/search/route.ts (Next.js example)
export const agentMeta = {
  tool: "searchProducts",
  description: "Search the product catalog by keyword and optional filters",
  version: "1.0.0",
  schema: {
    query: "string",
    limit: { type: "number", optional: true, default: 10 },
    category: { type: "string", optional: true },
  },
}

export async function GET(request: Request) {
  const { query, limit, category } = Object.fromEntries(new URL(request.url).searchParams)
  // ... search logic ...
}
```

---

## Model C — Agentic Desk (AHP MODE3)

**What it is**: The most powerful model. External agents delegate entire tasks to your site's own embedded agent, which handles them using your internal tools, data, and APIs.

**How it works**:
1. Agent discovers `/.well-known/agent.json` with `"modes": ["MODE3"]` and `"endpoints": { "task": "/agent/task" }`
2. Agent sends: `POST /agent/task` with a structured task payload:
   ```json
   {
     "task": "Export all transactions from the last 30 days as CSV",
     "context": { "userId": "usr_123", "format": "csv" },
     "webhook": "https://agent.example.com/callbacks/task-complete"
   }
   ```
3. SDK's task queue accepts the task, returns immediately with `{ "taskId": "tsk_abc", "statusUrl": "/agent/task/tsk_abc" }`
4. The task executor (running as a background job) uses your site's registered tools: queries the database for the last 30 days of transactions, formats as CSV, uploads to temporary storage
5. When complete, SDK POSTs to the agent's webhook: `{ "taskId": "tsk_abc", "status": "completed", "result": { "downloadUrl": "..." } }`
6. The visiting agent uses the result without needing to know anything about how your internal systems work

**What it covers**: Complex multi-step operations, data exports, report generation, batch processing, anything that would take multiple human interactions to complete.

**Who already does something similar**: Shopify's Checkout MCP server allows agents to complete purchases via JSON-RPC 2.0.

**SDK configuration**:
```typescript
// agentfriendly.config.ts
export default {
  // ... other config ...
  // MODE3 is enabled automatically when you register task handlers:
}

// A task handler registration
// app/api/agent/task/handlers/export-transactions.ts
import { registerTaskHandler } from "@agentfriendly/core/tools"

registerTaskHandler({
  name: "exportTransactions",
  description: "Export transaction records for a date range",
  schema: {
    startDate: "string",
    endDate: "string",
    format: { type: "string", enum: ["csv", "json", "excel"] },
  },
  handler: async (payload, context) => {
    const transactions = await db.transactions.findMany({
      where: {
        userId: context.userId,
        createdAt: { gte: payload.startDate, lte: payload.endDate },
      },
    })
    const csvUrl = await exportToCsv(transactions)
    return { downloadUrl: csvUrl, rowCount: transactions.length }
  },
})
```

---

## Summary: Which Model to Use

| Scenario | Model |
|----------|-------|
| Agent reads your documentation | A — Content Negotiation |
| Agent looks up product information | A — Content Negotiation |
| Agent searches your catalog | B — webagents.md tool |
| Agent asks a specific question about your product | B — AHP MODE2 converse |
| Agent submits a form (contact, checkout) | B — webagents.md tool |
| Agent exports data | C — AHP MODE3 task |
| Agent triggers a multi-step workflow | C — AHP MODE3 task |
| Agent needs to act on behalf of a user | C — AHP MODE3 task (+ Layer 8 multi-tenancy) |

The models are additive — you can implement all three simultaneously. Model A requires only the content middleware. Model B adds tool registration. Model C adds the task queue and handler registration.
