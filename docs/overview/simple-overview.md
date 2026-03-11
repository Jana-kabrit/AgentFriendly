# AgentFriendly — Complete Beginner's Guide

> **Who this is for**: Engineers who are new to the web-agent space. Every term is explained from scratch. No prior knowledge assumed.

---

## Table of Contents

1. [The Big Idea in One Paragraph](#1-the-big-idea-in-one-paragraph)
2. [What Is a Web Agent?](#2-what-is-a-web-agent)
3. [The Problem: Websites Were Built for Human Eyes](#3-the-problem-websites-were-built-for-human-eyes)
4. [Why This Is Expensive: Tokens](#4-why-this-is-expensive-tokens)
5. [The Existing Landscape: What Has Been Built Already](#5-the-existing-landscape-what-has-been-built-already)
6. [The Gap: What Nobody Has Built Yet](#6-the-gap-what-nobody-has-built-yet)
7. [The Solution: AgentFriendly SDK](#7-the-solution-agentfriendly-sdk)
8. [The 8-Layer Pipeline, Explained Simply](#8-the-8-layer-pipeline-explained-simply)
9. [Three Ways Agents Can Interact with Your Site](#9-three-ways-agents-can-interact-with-your-site)
10. [The Four Hard Problems We Solved](#10-the-four-hard-problems-we-solved)
11. [What We Chose Not to Build (and Why)](#11-what-we-chose-not-to-build-and-why)

---

## 1. The Big Idea in One Paragraph

When an AI agent visits a website today, it receives the same response a browser does: hundreds of kilobytes of HTML, navigation menus, cookie banners, ads, JavaScript bundles, and CSS — none of which has any value to the agent. The agent then has to pay (in time and money) to process all that noise before it can get to the 2 kilobytes of actual content it needed. **AgentFriendly is a software library that you install into your website's server, and it automatically detects when a visitor is an AI agent, strips away all the noise, and serves it exactly what it needs — in a fraction of the tokens, with full control over what it can see and do.**

---

## 2. What Is a Web Agent?

An **AI agent** is a program that uses a large language model (LLM, like GPT-5.3 or Claude) as its "brain" to make decisions and take actions autonomously. Unlike a chatbot that just answers questions, an agent can also *do things* — it can browse websites, fill out forms, write code, call APIs, and complete multi-step tasks without a human guiding each step.

**Examples of web agents you have probably encountered:**
- **Claude Code / Cursor / GitHub Copilot** — AI coding assistants that browse documentation sites while helping you write code.
- **ChatGPT with web browsing** — ChatGPT can visit websites to answer questions with up-to-date information.
- **Perplexity.ai** — An AI search engine that visits many websites to synthesize an answer.
- **Browser automation agents** — Tools like browser-use or Playwright-based agents that can navigate a website, fill in a form, or complete a checkout flow on your behalf.
- **SaaS integration agents** — AI tools that connect to your project management tool, CRM, or data platform on your behalf.

**How agents access websites**: Mostly the same way a browser does — by sending HTTP requests. Some agents use a real browser (Playwright or Puppeteer) with JavaScript. Many access URLs directly without a browser at all, similar to `curl`.

---

## 3. The Problem: Websites Were Built for Human Eyes

When you visit a website in Chrome, the server sends back an HTML file. That file contains the raw page content *plus* instructions for how to display it visually — colors, fonts, layout, animations, navigation menus, footers, sidebar widgets, ads, and so on. For a human, all of this makes the page easy and pleasant to read. For an AI agent, none of it matters.

Here is a concrete example. The Checkly documentation site has a page about monitoring. That page:
- As **HTML** (what the browser gets): **615 KB**, **180,573 tokens**
- As **Markdown** (just the content): **2.3 KB**, **478 tokens**

That is a **99.7% reduction** in what the agent needs to read. The markdown contains everything the agent actually wanted — the text, headings, code examples, and links — with no visual decoration.

> **What is Markdown?** Markdown is a simple plain-text format for writing structured content. Headings use `#`, bold uses `**`, code blocks use triple backticks. It is readable as plain text but also easy to render visually. GitHub READMEs, this document, and most documentation sites are written in Markdown.

---

## 4. Why This Is Expensive: Tokens

LLMs like GPT-5.3 do not read text the way a human reads it. They process text in chunks called **tokens** — roughly one token per word, or about 4 characters. Every token you send to an LLM (input) and every token it generates in reply (output) costs money.

**Current pricing (GPT-5.3, March 2026):** $1.75 per million input tokens, $14 per million output tokens.

Reading one 615 KB HTML page costs approximately:
- **$0.32** if processed as raw HTML (180,573 tokens × $1.75/M)
- **$0.0008** if processed as Markdown (478 tokens × $1.75/M)

That sounds small for one page, but agents often browse dozens or hundreds of pages per task. Real-world agent browsing sessions have been measured at **$5–8 per session** when processing raw HTML. A company running thousands of such sessions daily is looking at significant infrastructure costs — and that cost is borne by whoever runs the agent.

**The website owner has a strong incentive to serve lean content** — it reduces the cost for agents using their site, making their site more attractive to agent developers and LLM platforms.

---

## 5. The Existing Landscape: What Has Been Built Already

The web-agent space exploded in January–March 2026. Here is everything that has been built and how each piece works.

---

### 5.1 `llms.txt` — A Sitemap for AI

**What it is**: A plain text file you place at `yourdomain.com/llms.txt`. It contains a short description of your site and links to the most important pages, formatted for LLMs to understand.

**How it works**: An AI agent or crawler visits `/llms.txt` first to understand what your site is about and which pages are worth reading — similar to how search engines use `sitemap.xml`.

**Limitation**: Not widely adopted by agents yet. Anthropic, Perplexity, and a few others check for it. Most agents still ignore it.

**Example:**
```
# Acme Corp

> We sell project management software for engineering teams.

## Documentation
- [Getting Started](/docs/getting-started)
- [API Reference](/docs/api)

## Pricing
- [Pricing Page](/pricing)
```

---

### 5.2 `robots.txt` AI Directives — Telling Crawlers What to Skip

**What it is**: The `robots.txt` file has existed since 1994 to tell web crawlers which pages they should not visit. AI crawlers now respect the same format.

**How it works**: You add specific AI user-agent names to your `robots.txt` with `Disallow` rules.

**Important distinction**: There are two types of AI crawlers:
- **Training crawlers** (GPTBot, ClaudeBot, Google-Extended): These visit your site to absorb content into a model's training data. They do not send traffic back to you — they just take your content.
- **Citation/browsing bots** (ChatGPT-User, PerplexityBot): These visit your site when an AI assistant is answering a question, and they often *cite* your site, which can drive referral traffic to you.

Most site owners want to block training crawlers but allow citation bots.

**Limitation**: `robots.txt` only tells crawlers what pages to skip. It cannot serve different content to agents vs. humans, charge for access, track who visited, or restrict what data they can see.

---

### 5.3 HTTP Content Negotiation — Asking for Markdown

**What it is**: A standard mechanism (built into HTTP since 1997) where a client tells the server what format it prefers.

**How it works**: The agent adds an `Accept` header to its request:
```
Accept: text/markdown, text/html, */*
```
The server checks this header and — if it supports it — returns the same content as Markdown instead of HTML.

**The problem**: Only 3 out of 7 major agents actually send this header (Claude Code, Cursor, OpenCode). Gemini CLI, Windsurf, GitHub Copilot, and OpenAI Codex do not. So relying only on this header misses the majority of agent traffic.

---

### 5.4 Cloudflare "Markdown for Agents" — CDN-Level Conversion

**What it is**: Cloudflare is the company that powers the network layer for roughly 20% of all websites. They built a feature (February 2026) that automatically converts your HTML to Markdown *at their servers*, before sending it to any agent.

**How it works**: When an agent visits a site on Cloudflare, Cloudflare detects the agent's User-Agent, converts the HTML to Markdown on the fly, and returns the Markdown version. It also adds an `x-markdown-tokens` header with the estimated token count.

**Limitation**: Only works if your site is already on Cloudflare. Does not help Express, Django, or self-hosted sites.

---

### 5.5 Cloudflare Content Signals — Declaring Your AI Permissions

**What it is**: A new HTTP response header format (February 2026) that lets websites declare whether their content can be used for AI training, real-time retrieval, or search indexing.

**How it works**: Your server adds a `Content-Signal` header:
```
Content-Signal: ai-train=no, ai-input=yes, search=yes
```
This tells crawlers: "You can use my content to answer real-time queries (AI input), and you can index it for search — but you cannot use it to train a new model."

**Who cares**: AI companies have legally committed to respecting these signals under EU law (EU Directive 2019/790). Setting `ai-train=no` gives you legal recourse if a company uses your content for training despite the signal.

---

### 5.6 `webagents.md` — JavaScript Functions for Agents

**What it is**: A proposal by the browser-use project. Instead of just reading your website, agents can *call functions* you publish in a special manifest file.

**How it works**:
1. You add a `<meta>` tag to your site: `<meta name="webagents-md" content="/webagents.md">`
2. You create a `/webagents.md` file that lists JavaScript functions available on your site, like a menu
3. An agent framework reads the manifest, sees you have a `searchProducts(query, filters)` function, and calls it directly
4. The function runs in the browser (via Playwright) without the agent needing to click buttons or fill forms

**Why it matters**: The agent can complete actions without navigating multiple pages and dealing with HTML. One function call replaces a 5-step form submission workflow.

---

### 5.7 Agent Handshake Protocol (AHP) — A Discovery Standard

**What it is**: An emerging standard for how agents discover and interact with websites. It defines a `/.well-known/agent.json` file that describes what your site can do.

**How it works**: Agents look for `/.well-known/agent.json` on your domain. The file describes three interaction modes:
- **MODE1**: Read-only. Agent reads content as markdown (most basic).
- **MODE2**: Q&A. Agent can POST questions to an endpoint, get structured answers back.
- **MODE3**: Task delegation. Agent submits a full task, your site's own AI handles it and reports back when done.

---

### 5.8 Agent Identity Verification — Proving Who Is Calling

**What it is**: Because any HTTP client can lie about its User-Agent header (e.g., anyone can add `User-Agent: GPTBot/1.0` and pretend to be OpenAI), a system was needed to *cryptographically prove* an agent's identity.

**How it works (RFC 9421 — the main standard)**:
- The agent operator (e.g., OpenAI) generates a cryptographic key pair — a public key and a private key.
- They publish the public key at a known URL on their domain.
- Every request their agent sends includes a *digital signature* — a mathematical proof that was created using their private key.
- Your server can verify that signature against their public key. If it matches, the request is genuinely from that operator. It is impossible to forge without the private key.

> **Analogy**: Think of it like a wax seal on a letter. Only the sender has the unique seal stamp. When you receive a letter with that seal, you can be confident it came from them — it cannot be faked.

**Clawdentity**: A newer system (IETF draft, February 2026) that adds a *registry* layer. Instead of agents self-asserting their identity, a neutral third party vouches for them by issuing a signed "Agent Identity Token" (AIT) — similar to how a notary certifies a document.

---

### 5.9 x402 — Charging Agents for Access

**What it is**: An open protocol (launched by Coinbase, May 2025) that allows websites to charge AI agents per-request using stablecoin micropayments, with no accounts, no human intervention, and no minimum charge floor.

**How it works**:
1. Agent requests a resource.
2. Server responds with HTTP 402 ("Payment Required") and a machine-readable description of the price, the wallet address to pay, and which currency.
3. Agent pays automatically — typically $0.001 in USDC.
4. Agent retries the request, including a cryptographic proof of payment.
5. Server verifies the proof and returns the content.

> **What is USDC?** USDC (USD Coin) is a "stablecoin" — a cryptocurrency that is always worth exactly $1.00 USD. Unlike Bitcoin or Ethereum, there is no price volatility. It runs on fast, cheap networks like Coinbase's "Base" chain where transactions cost less than $0.001.

> **What is HTTP 402?** HTTP status codes are the three-digit numbers servers use to describe responses: 200 = OK, 404 = Not Found, 500 = Server Error. The number 402 ("Payment Required") has been reserved in the HTTP standard since 1997 but was never used — until x402.

**By January 2026**: x402 had 100 million+ payment flows and $600 million in total volume. It is backed by Coinbase, Cloudflare, Google, AWS, Anthropic, and Circle.

---

### 5.10 TollBit — A Non-Crypto Paywall for Agents

**What it is**: A SaaS product that lets you charge AI crawlers for access to your content, without cryptocurrency. Publishers set rates; TollBit handles all billing.

**How it works**: Because bots do not execute JavaScript (unlike browsers), TollBit can route bot traffic to a separate subdomain using CDN rules — where a paywall is enforced. Publishers connect their site; bot traffic goes through TollBit's billing layer automatically.

**When to use vs x402**: x402 is the open standard, zero-fee option but requires agents to have a USDC wallet. TollBit is the fallback for agents that do not support x402 yet. AgentFriendly supports both.

---

### 5.11 Dark Visitors — Agent Traffic Analytics

**What it is**: A SaaS product that tracks what AI crawlers are visiting your site and how often.

**How it works**: Agents do not execute JavaScript (most of them), so they are invisible to Google Analytics and other JavaScript-based analytics tools. Dark Visitors reads server-side HTTP logs, which do capture all requests regardless. It identifies known agent User-Agents in those logs and provides a dashboard showing the breakdown of human vs. agent traffic.

**Key finding**: They track 40%+ of web traffic as bots/agent traffic that most site owners do not realize exists.

---

### 5.12 Firecrawl, Jina, AgentQL — External Conversion Services

These are services that *agent developers* use (not site owners). Instead of building markdown conversion into your site, agent developers route their requests through these services which fetch the URL and convert it.

- **Firecrawl**: SaaS. Takes a URL, returns clean Markdown or structured JSON. $16/month for 3,000 pages.
- **Jina Reader**: Prepend `r.jina.ai/` to any URL and get Markdown back. Uses a 1.5B parameter model.
- **AgentQL**: AI-powered web automation. Writes self-healing selectors that work even when the site's HTML changes.

**Why these do not replace our SDK**: They are *external* to the site. The site owner has no control over them, cannot restrict what they extract, cannot track who is using them, cannot charge for access, and cannot serve specialized agent responses. They are tools for *agent developers*, not *website owners*.

---

## 6. The Gap: What Nobody Has Built Yet

After surveying everything in Section 5, one thing is missing: **a single library that a website developer can install to get all of this in one place.**

Here is what exists individually but not together:

| What You Need | What Exists | Problem |
|---|---|---|
| Serve Markdown to agents | Cloudflare feature | Only if you're on Cloudflare |
| Serve Markdown to agents | Vercel approach | Only if you're on Next.js + Contentful |
| Agent traffic analytics | Dark Visitors | External SaaS, no code changes |
| Block specific crawlers | `robots.txt` | No per-route control, no content control |
| Charge agents for access | x402 library | No agent detection, no integration with the above |
| Verify agent identity | RFC 9421 libraries | Standalone, not integrated with access control |
| Expose tools to agents | `webagents.md` SDK | Browser-only, no server-side layer |
| Protect PII from agents | Nothing | No solution exists |
| Multi-tenant agent sessions | Nothing | No solution exists |

**AgentFriendly fills this gap** — a single middleware library that does all 11 of the above, for any web framework (Next.js, Express, Hono, Nuxt, Astro in TypeScript; FastAPI, Django, Flask in Python).

---

## 7. The Solution: AgentFriendly SDK

AgentFriendly is a **middleware SDK**. Middleware is code that runs between when a server receives a request and when it sends a response — it can inspect the request, modify what gets sent back, block requests entirely, or pass them through unchanged.

> **Analogy**: Think of middleware like a security checkpoint at an office building. Every visitor (request) passes through the checkpoint. The checkpoint can identify who they are, decide if they're allowed in, give them a visitor badge (context), and tell them which areas they can access — all before they reach their destination.

**The key design principle**: Human visitors are unaffected. If a person opens your website in Chrome, the middleware detects this, does nothing, and their experience is identical to what it would be without the SDK. The entire system only activates for AI agents.

**How you install it**: One function call wraps your existing web server. No changes to your route handlers, database, or business logic are required.

```typescript
// Before AgentFriendly
app.use(express.json());
app.get("/blog/:slug", blogHandler);

// After AgentFriendly — one additional line
app.use(express.json());
app.use(createAgentFriendlyMiddleware({ siteName: "My Blog" })); // ← this line
app.get("/blog/:slug", blogHandler);
```

That one line gives you agent detection, markdown serving, discovery files, and content signal headers. Every other feature is opt-in.

---

## 8. The 8-Layer Pipeline, Explained Simply

Every incoming request passes through up to 8 processing layers. Each layer has one job, and each layer can optionally stop the pipeline early (for example, by returning a 403 Forbidden response before the request ever reaches your code).

Here is a plain-language description of each layer.

---

### Layer 0: Detection — Who Is This?

**Job**: Figure out whether the visitor is a human, a suspected AI agent, a known AI agent, or a verified AI agent.

This is the most important layer. All other layers use this result to make decisions.

**Four signals are combined:**

**Signal 1 — Accept Header**: Does the request include `Accept: text/markdown` or `Accept: application/agent+json`? If yes, this visitor at least prefers markdown, which humans never do.

**Signal 2 — User-Agent Database**: Does the `User-Agent` header match a known AI crawler? The SDK ships with a database of 50+ known agents (GPTBot, ClaudeBot, PerplexityBot, etc.). If there is a match, we know the operator (e.g., "OpenAI") and the type (e.g., "crawler").

**Signal 3 — Header Heuristics**: Even if no headers explicitly identify the visitor as an agent, some patterns give it away. Real browsers always send an `Accept-Language` header — agents often do not. Browsers send `Sec-Fetch-*` headers — most agents do not. A minimal `Accept: */*` with no language preferences and no fetch metadata is suspicious. Scoring 2+ of these suspicious patterns = suspected agent.

**Signal 4 — Cryptographic Verification**: If the request includes an RFC 9421 digital signature or a Clawdentity identity token, verify it cryptographically. If valid, the agent's identity is confirmed with certainty.

**The output — Trust Tiers**: Every request ends up classified as one of four levels:
- `human` → A real browser. Skip all further processing.
- `suspected-agent` → Looks like an agent but not confirmed.
- `known-agent` → Confirmed via UA database or strong headers.
- `verified-agent` → Cryptographically proven identity.

---

### Layer 8 (runs 2nd): Multi-Tenancy Pre-Flight — Which User Is This Agent Acting For?

**Job**: If the agent is presenting a "delegation token" (a credential that says "I am acting on behalf of user X"), validate it and attach the user context.

This only runs for SaaS platforms where agents act on behalf of specific users. See Section 10.4 for a full explanation.

---

### Layer 1: Discovery — Serving the Agent's Map

**Job**: Serve the static "agent discovery files" that let agents understand your website without scraping it.

If the request is for any of these paths, the layer intercepts and serves the file immediately:

| Path | What It Is |
|------|-----------|
| `/llms.txt` | Plain-text description of your site for LLMs |
| `/.well-known/agent.json` | Machine-readable list of your site's capabilities |
| `/webagents.md` | Markdown list of JavaScript tools agents can call |
| `/.well-known/agent-tools.json` | Full JSON Schema definitions for all registered tools |
| `/agent-debug` | Debug info (only in development mode) |

These files are generated once when the server starts and kept in memory. Every subsequent request for them is just a memory lookup — extremely fast.

---

### Layer 4: Access Control — Should This Agent Be Allowed Here?

**Job**: Block agents from routes they are not allowed to access, and enforce rate limits.

You configure rules like:
```
Block all agents from /admin/**
Require verified identity for /api/premium/**
Rate-limit to 100 requests per minute per agent
```

When a rule blocks a request, the layer returns a `403 Forbidden` response with a structured JSON explanation. When the rate limit is exceeded, it returns `429 Too Many Requests` with a `Retry-After` header.

Human requests are not affected by any of these rules.

---

### Layer 7: Monetization — Does This Agent Need to Pay?

**Job**: Enforce payment for specific routes using the x402 protocol.

You configure which routes cost money:
```
GET /premium-report → $0.001 USDC per request
POST /api/search   → $0.0001 USDC per request
```

When an agent hits a paid route without a valid payment proof, the layer returns a `402 Payment Required` response describing the cost and how to pay. The agent pays and retries. This all happens automatically — no human involvement needed.

Human visitors are never affected by this layer (they were already exited in Layer 0).

---

### Layer 2: Content Negotiation — Should This Response Be Markdown?

**Job**: Decide whether to convert the response body from HTML to Markdown for this request, and build the appropriate response headers.

The decision is based on:
1. Does the `Accept` header explicitly request `text/markdown`? → Always convert.
2. What is the trust tier? Compared against the `proactiveMarkdown` setting:
   - `"known"` (default) → Convert for `known-agent` and `verified-agent` tiers.
   - `"suspected"` → Also convert for `suspected-agent` tier.
   - `false` → Only convert if explicitly requested via `Accept` header.
3. Is this path excluded? (e.g., JSON API endpoints should never be converted)

This layer only *decides* and *prepares headers*. The actual HTML→Markdown conversion happens afterward in the framework adapter.

**The Conversion Pipeline** (when it runs):
1. **jsdom**: Parses the HTML into a DOM tree (like what a browser builds)
2. **@mozilla/readability**: Mozilla's content extraction library — the same one Firefox uses for Reader Mode. Identifies the main article content and strips navigation, ads, sidebars, footers.
3. **turndown**: Converts the remaining HTML to clean Markdown.

In Cloudflare Workers and Next.js Edge Runtime environments (which do not have Node.js APIs), a simpler regex-based fallback is used instead.

---

### Layer 3: Analytics — What Are Agents Doing On My Site?

**Job**: Emit analytics events for agent activity, silently in the background.

Events tracked:
- Agent page views (which path, which tier, which operator, token count saved)
- Tool calls (which tool, how long it took, success/failure)
- Access denials (which path, which rule blocked it)
- Payment events (which route, how much was charged)
- **LLM referrals**: When a *human* arrives from `chat.openai.com`, `claude.ai`, `perplexity.ai`, etc. — meaning an LLM sent them to you. This is valuable marketing attribution data.

These events are emitted into an in-memory buffer and flushed to a webhook URL in batches. They never slow down the response — the flush happens asynchronously after the response is sent.

---

### Layer 5: Privacy & PII Masking — What Should Agents Not See?

**PII** stands for Personally Identifiable Information — data that can identify a real person, like email addresses, phone numbers, social security numbers, or credit card numbers.

**Job**: Automatically redact PII from agent responses so agents cannot read sensitive user data unless they are specifically authorized to.

By default, fields like `email`, `phone`, `ssn`, and `creditCardNumber` are replaced with placeholder tokens:
```json
{ "email": "[EMAIL]", "phone": "[PHONE]", "ssn": "[SSN]" }
```

Agents can still perform their tasks (they know a user *has* an email), but they cannot read the actual value. This protects user privacy and helps with GDPR/CCPA compliance.

If an agent *does* need to see certain fields (for example, an agent acting on behalf of the user to update their email), the multi-tenancy layer (Layer 8) can grant specific "reveal scopes" — see Section 10.4.

---

### Layer 6: Tool Registry — What Can Agents Do on My Site?

**Job**: Maintain a registry of callable functions ("tools") that agents can invoke, and handle tool invocations.

This is what transforms your website from a place agents can *read* into a platform agents can *use*.

You register tools like:
```typescript
registerTool({
  name: "searchProducts",
  description: "Search the product catalog",
  schema: { query: "string", category: "string" },
  handler: async (input) => {
    return await db.products.search(input.query, input.category);
  },
});
```

This tool is then:
- Published at `/.well-known/agent-tools.json` for agents to discover
- Callable via `POST /agent/tools/searchProducts`
- Input-validated against the JSON Schema automatically
- Subject to access control (which agents can call it)
- Subject to monetization (you can charge per call)

---

## 9. Three Ways Agents Can Interact With Your Site

These three models are additive — you can implement one, two, or all three simultaneously.

---

### Model A — Read-Only (Just Markdown)

The simplest model. An agent visits a URL and gets back clean Markdown instead of HTML.

```
Agent → GET /docs/api-reference
         Accept: text/markdown

Server → 200 OK
          Content-Type: text/markdown
          x-markdown-tokens: 478

          # API Reference
          ## Authentication
          All requests require an Authorization header...
```

No changes to your routes. Just install the middleware.

---

### Model B — Action Invocation (Tools)

The agent can call functions that actually *do things* on your server.

```
Agent discovers tools at /.well-known/agent-tools.json
Agent → POST /agent/tools/createProject
         { "name": "Q2 Planning", "template": "starter" }

Server → 200 OK
          { "projectId": "proj_abc123", "url": "/projects/proj_abc123" }
```

The agent completed a task that would have taken a human 4 clicks and a page load.

---

### Model C — Async Task Delegation (Long-Running Work)

The agent submits a task that might take 30 seconds or 2 minutes. Your site handles it and reports back.

```
Agent → POST /agent/tasks/exportTransactions
         { "startDate": "2024-01-01", "endDate": "2024-03-31", "format": "csv" }

Server → 202 Accepted
          { "taskId": "task_xyz", "pollUrl": "/agent/tasks/task_xyz" }

(30 seconds later, agent polls...)
Agent → GET /agent/tasks/task_xyz

Server → 200 OK
          { "status": "complete", "result": { "downloadUrl": "..." } }
```

This is the model for anything complex: report generation, data exports, batch processing, multi-step workflows.

---

## 10. The Four Hard Problems We Solved

These four problems existed in the landscape but had no good solutions. They were designed into AgentFriendly from the start.

---

### 10.1 The `text/markdown` Adoption Problem

**Problem**: Only 3 of 7 major AI agents actually send `Accept: text/markdown`. If you rely on that header alone, you miss more than half of agent traffic.

**Solution**: The SDK uses a multi-signal detection pipeline. Even agents that do not send the markdown Accept header are identified via the User-Agent database and header heuristics. The `proactiveMarkdown` config setting controls whether the SDK serves markdown to confirmed-but-not-asking agents. The default (`"known"`) covers the majority of real-world agent traffic.

---

### 10.2 Agent Identity Verification

**Problem**: User-Agent headers are trivially fakeable. Any scraper can claim to be GPTBot. This means "only allow GPTBot to access this route" is not a meaningful access control rule.

**Solution**: The SDK implements RFC 9421 HTTP Message Signatures. When an agent signs its requests with a private key, the server can verify the signature against the agent's published public key — making identity claims unfakeable. Only route handlers that require `verified-agent` tier can be reliably restricted to specific operators.

---

### 10.3 Monetization

**Problem**: You cannot charge AI agents for access using Stripe (requires a human to enter a credit card). API keys require account creation and are not suitable for autonomous sessions. There was no machine-native payment mechanism.

**Solution**: x402 as the primary payment mechanism, with TollBit as a fallback. x402 allows agents to pay per-request in USDC, fully autonomously. The payment proof is cryptographically self-contained — the server verifies it without calling a payment processor. No accounts, no KYC, no human involvement. TollBit handles agents that have not implemented x402 yet.

---

### 10.4 Multi-Tenancy in SaaS

**Problem**: In a SaaS platform, many users share the same server. When an agent visits on behalf of User A, how does the server know which user's data to show? And how do you prevent the agent from reading User B's private data?

**Example**: Imagine an AI assistant that integrates with your project management SaaS. Alice logs in and connects her AI assistant. The assistant needs to read Alice's tasks — but the server should never reveal Bob's tasks, Carol's email address, or any other user's data to Alice's agent.

**Solution**: RFC 8693-inspired delegation tokens.

1. **Alice logs into your app** via her normal browser session.
2. **Your app issues Alice's agent a "delegation token"** — a signed JSON Web Token (JWT) that encodes: *"I am acting on behalf of Alice (user_alice_123) on tenant Acme Corp. I am allowed to read tasks and reveal her email address."*
3. **Alice gives this token to her AI assistant**.
4. **The assistant includes the token** on every request: `X-Agent-Session: <token>`.
5. **The SDK validates the token** and tells every route handler: "This request is from Alice's agent, on Acme Corp's tenant, with read-task and reveal-email permissions."
6. **Route handlers scope their database queries** to Alice's data. PII masking is bypassed only for Alice's email (because the token grants that scope).

The agent cannot escalate its own permissions — the scopes are set by your server when the token is issued, not by the agent.

---

## 11. What We Chose Not to Build (and Why)

Making deliberate decisions about what *not* to build is just as important as what to build. Here are four decisions we made.

---

### 11.1 No WebMCP Support (Yet)

**What it is**: A Chrome browser API (announced February 2026, Chrome 146 Canary) that allows websites to register tools that browser-native AI agents can call via JavaScript.

**Why we excluded it**: It is only available in a Canary (experimental) build of Chrome as of March 2026. It only works for in-browser agents, not CLI tools, API agents, or Playwright agents (which make up the majority of agent traffic today). The spec may still change before stable release. We will build `@agentfriendly/webmcp` as a plugin after Chrome stable ships — without changing the SDK's existing API.

---

### 11.2 No Stripe or Traditional Payment Integration

**Why**: Stripe requires a human to set up a merchant account, add a payment method, complete KYC verification, and manage subscriptions. An autonomous AI agent cannot do any of these things. Traditional payment flows are fundamentally incompatible with autonomous agent access patterns. x402 was specifically designed to solve this, and TollBit handles agents that are not on x402 yet. Stripe would add complexity without solving any new problem.

---

### 11.3 Tool Versions Are Independent of SDK Versions

**Why**: If you bump a tool's API (add a new required parameter), that should not force a new major version of the entire AgentFriendly package. Tool versions follow their own semantic versioning. An agent that learned to call `searchProducts@1.0` can continue to do so even after `searchProducts@2.0` ships with a different schema — both versions live in the registry simultaneously.

---

### 11.4 Python SDK from Day One

**Why**: Python is the dominant language in the AI/ML ecosystem. FastAPI, Django, and Flask are used by many of the teams building agent-heavy backends. The agent UA database is a shared JSON file — no duplication. Having a Python SDK from day one prevents it from becoming a permanently second-class implementation that falls behind the TypeScript version.

---

## Quick Reference: Mapping Concepts to Layers

| Concept | Layer | What It Does |
|---------|-------|-------------|
| Who is this? | Layer 0 | Classifies visitor as human/suspected/known/verified |
| What's on your site? | Layer 1 | Serves llms.txt, agent.json, tool manifests |
| Readable content | Layer 2 | Converts HTML → Markdown for agents |
| Usage tracking | Layer 3 | Tracks agent visits, tool calls, LLM referrals |
| Who's allowed in? | Layer 4 | Enforces route-level access policies and rate limits |
| Privacy | Layer 5 | Masks email, phone, SSN, and other PII |
| Action capabilities | Layer 6 | Registers callable tools agents can invoke |
| Revenue | Layer 7 | Charges agents per-request via x402 |
| SaaS user scoping | Layer 8 | Scopes agent sessions to specific users/tenants |
