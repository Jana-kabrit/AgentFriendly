# Firecrawl and Jina Reader — External Content Extraction

## What They Are

Firecrawl and Jina Reader are external services that convert any URL into clean, LLM-ready content. They are used by **agent developers** who need to extract readable text from websites they do not own.

They are fundamentally different from `@agentfriendly`: instead of helping a site owner make their site agent-friendly from the inside, they help an agent developer consume any site from the outside — including sites that have made no agent-friendly investments at all.

---

## Firecrawl

- Website: [firecrawl.dev](https://firecrawl.dev)
- Pricing: From $16/month for 3,000 pages (page-credit model)
- Creator: Mendable.ai

### What Firecrawl Does

Firecrawl converts any URL to clean Markdown or structured JSON. It handles:
- JavaScript-rendered SPAs (it runs a real Chromium browser)
- Pagination (automatically crawls "next" buttons)
- Authentication (can handle login flows)
- Anti-bot bypass (advanced fingerprinting)
- Rate limiting and retries

```python
from firecrawl import FirecrawlApp

app = FirecrawlApp(api_key="fc-xxx")

# Scrape a single URL
result = app.scrape_url("https://docs.example.com/getting-started", {
    "formats": ["markdown", "html"],
    "onlyMainContent": True,
})
print(result.markdown)
# → "# Getting Started\n\nTo install the SDK..."

# Crawl an entire site
crawl_result = app.crawl_url("https://docs.example.com", {
    "limit": 100,
    "scrapeOptions": { "formats": ["markdown"] },
})
```

### Firecrawl vs. Jina Reader

| Feature | Firecrawl | Jina Reader |
|---------|-----------|-------------|
| Approach | Chromium browser + LLM-assisted extraction | Rule-based + ReaderLM-v2 (1.5B model) |
| JavaScript | Full Chromium rendering | Headless Chrome with wait-for selectors |
| Speed | 2–100 concurrent browsers | 20–5,000 RPM throughput |
| Pricing | Per page (non-rolling credits) | Per token (rolling 6 months) |
| CLI/API | REST API, Python SDK, TypeScript SDK | Prefix URL with `r.jina.ai/` |
| Schema extraction | Yes — JSON schemas without selectors | Limited |

---

## Jina Reader

- Website: [jina.ai/reader](https://jina.ai/reader)
- Pricing: ~$0.02 per million tokens after 10M free tokens
- Model: ReaderLM-v2 (1.5B parameter model, open-source)

### What Jina Reader Does

The simplest possible interface: prepend `r.jina.ai/` to any URL.

```bash
# Get markdown from any URL
curl "https://r.jina.ai/https://docs.example.com/getting-started"
```

This works for any HTTP client with no API key for the free tier. ReaderLM-v2 uses ML-based noise removal to identify the main content of a page.

### How ReaderLM-v2 Works

ReaderLM-v2 is a 1.5B parameter model fine-tuned to read HTML and extract the main content, similar to how a human reader ignores navigation and ads. Unlike rule-based approaches (Mozilla Readability, which uses heuristics like element size and content density), ReaderLM-v2 uses learned patterns.

This makes Jina Reader better than rule-based tools on unusual page layouts, but slightly slower and more expensive.

---

## Why These Are Workarounds, Not Native Solutions

Both tools extract content **after the fact** — they are applied by agent developers to counteract sites that were not designed for agents.

**Problems with this approach**:

1. **Quality**: The extraction is a best-effort heuristic. Dynamic content loaded by JavaScript after page load may be missed. Authenticated content requires complex cookie/session handling.

2. **No access control**: These tools fetch your content regardless of your intent. You cannot tell Firecrawl "only allow access to /docs, not /billing". You cannot tell Jina Reader to stop.

3. **No analytics**: You do not know that Firecrawl is fetching your content. It appears as a headless browser request in your logs.

4. **No monetization**: These services charge the agent developer, not you (the content owner).

5. **Latency**: Fetching through an external service adds 200–2000ms of latency per request.

6. **Not bidirectional**: These tools are read-only. An agent cannot call `addToCart()` through Jina Reader.

---

## When To Use Them

As an **agent developer** (not a site owner):
- You need to scrape a site that has no agent-friendly features
- You need to crawl a large site for RAG pipeline ingestion
- You need to extract structured data from an HTML-only source
- You need anti-bot bypass for a site using Cloudflare protection

As a **site owner**:
- You do not need Firecrawl or Jina Reader — you need `@agentfriendly`

## How `@agentfriendly` Makes These Unnecessary

When a site implements `@agentfriendly`, agents no longer need Firecrawl or Jina Reader to get clean content from that site:
- Content is served as markdown natively (Layer 2)
- Discovery files tell agents exactly what content exists (Layer 1)
- Tools are callable directly via the tool manifest (Layer 6)
- Analytics tell the site owner which agents are reading their content (Layer 3)

Firecrawl and Jina Reader will always have value for sites that have not invested in agent-friendliness. `@agentfriendly` makes them unnecessary for your site.
