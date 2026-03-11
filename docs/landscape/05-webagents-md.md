# webagents.md — In-Browser Tool Discovery

## What It Is

`webagents.md` is a proposed specification by browser-use that lets websites expose JavaScript functions to AI agents for direct in-browser invocation. It functions as "robots.txt for AI tools" — instead of telling crawlers which URLs to avoid, it tells agents which functions they can call.

- GitHub: [github.com/browser-use/webagents.md](https://github.com/browser-use/webagents.md)
- Python SDK: `pip install webagents-md` (v0.1.0, MIT license)
- Requires Python 3.11+

## How It Works

### Step 1: Website publishes `webagents.md`

A markdown file listing available JavaScript functions with their signatures:

```markdown
# Product Catalog Tools

## searchProducts

Search the product catalog by keyword.

```typescript
async function searchProducts(query: string, options?: {
  limit?: number;
  category?: string;
  sortBy?: "relevance" | "price" | "rating";
}): Promise<{ id: string; name: string; price: number; rating: number }[]>
```

Returns an array of matching products sorted by the specified field.

## addToCart

Add a product to the current shopping cart.

```typescript
async function addToCart(productId: string, quantity: number): Promise<{
  cartTotal: number;
  itemCount: number;
}>
```
```

### Step 2: Website adds a meta tag for discovery

```html
<meta name="webagents-md" content="/webagents.md">
```

### Step 3: Agent framework parses the manifest

The `webagents-md` Python SDK detects the meta tag, fetches `/webagents.md`, and converts the TypeScript function signatures into type declarations that the LLM can understand.

### Step 4: Agent writes and executes code

The LLM receives the type declarations and writes code:

```typescript
// Agent-generated code, executed in browser via Playwright
const results = await global.searchProducts("red running shoes", {
  limit: 5,
  category: "footwear",
  sortBy: "rating"
})

const topResult = results[0]
await global.addToCart(topResult.id, 1)
```

The `webagents-md` SDK executes this code in the browser via Playwright using an `execute_js` tool. Multiple function calls can be chained in a single execution without round-trips — the entire sequence runs in one shot.

## Why This Approach Works Well

LLMs write TypeScript code significantly better than they make traditional function calls (JSON tool invocations). Giving the agent TypeScript type declarations and asking it to write code leverages the LLM's strongest capability.

The chaining is also important: instead of:
1. Agent calls `searchProducts` → waits for result → calls `addToCart` → waits for result

The agent writes:
```typescript
const results = await global.searchProducts("red shoes")
await global.addToCart(results[0].id, 1)
```
And the entire sequence executes in a single Playwright operation.

## Comparison to WebMCP

| Feature | webagents.md | WebMCP |
|---------|-------------|--------|
| Browser support | Any headless browser | Chrome 146+ only |
| Status | MIT-licensed SDK on PyPI | W3C Draft, Canary-only |
| Language | TypeScript function signatures in markdown | JSON Schema v7 |
| Execution | Playwright `evaluate()` | Chrome's `navigator.modelContext` |
| Discovery | `<meta>` tag | HTML attributes or JS API |
| Infrastructure | Any web server | Chrome browser only |

webagents.md works with Playwright, Puppeteer, and any browser automation framework. WebMCP only works in Chrome. For maximum compatibility, webagents.md is the choice today.

## Limitations

- **Playwright required**: The agent framework must be Playwright-based (or support `execute_js`). Not all agents do.
- **JavaScript execution**: The website must have working JavaScript functions registered under `global.*`. Server-side-only routes cannot be called this way.
- **Security**: Any code the LLM writes will execute in the browser. The site must implement appropriate sandboxing.
- **Python only**: The reference SDK is Python. No TypeScript SDK exists yet.

## How `@agentfriendly` Handles This

`@agentfriendly` treats `webagents.md` as a discovery and documentation format, not a runtime.

1. **Auto-generates `webagents.md`** from your registered tools (routes with `agentMeta` annotations)
2. **Serves `webagents.md`** at `/webagents.md`
3. **Injects the meta tag** into HTML responses for agents using headless browsers
4. **Registers the JavaScript functions** on the page so they are callable as `global.<toolName>()`

The actual execution goes through your route handlers (HTTP), not JavaScript evaluation — which is more secure and supports server-side-only operations.
