# WebMCP — Chrome's Agent Tool Standard

## What It Is

WebMCP (Web Model Context Protocol) is a proposed web standard that enables websites to expose structured tools to AI agents running inside a browser. Instead of an agent scraping DOM elements and simulating clicks, it calls typed functions directly.

Developed by Google and Microsoft, released as an early preview in Chrome 146 Canary on February 10, 2026. It is a W3C Draft Community Group Report as of March 5, 2026.

**Key stat**: WebMCP achieves 89% token efficiency improvement over screenshot-based methods.

## How It Works

WebMCP provides two complementary APIs.

### Declarative API (HTML Attributes — Zero JavaScript)

For simple forms, add `toolname` and `tooldescription` attributes:

```html
<form toolname="searchProducts"
      tooldescription="Search the product catalog by keyword">
  <input name="query"
         toolparamdescription="The search term to look for"
         type="text" />
  <input name="limit"
         toolparamdescription="Maximum number of results (default 10)"
         type="number"
         value="10" />
  <button type="submit">Search</button>
</form>
```

Chrome exposes this form to any AI agent running in the browser as a callable tool. The agent calls `searchProducts({ query: "red shoes", limit: 5 })` instead of finding the input field by CSS selector, clicking it, typing, and clicking submit.

### Imperative API (JavaScript — Complex Interactions)

For dynamic interactions:

```javascript
navigator.modelContext.registerTool({
  name: "checkoutCart",
  description: "Complete the checkout process with items in the current cart",
  input: {
    type: "object",
    properties: {
      shippingAddress: {
        type: "string",
        description: "Full shipping address including postal code"
      },
      paymentToken: {
        type: "string",
        description: "Payment token from the payment provider"
      }
    },
    required: ["shippingAddress", "paymentToken"]
  },
  execute: async (args) => {
    const result = await api.checkout(args)
    return { orderId: result.id, estimatedDelivery: result.eta }
  }
})
```

### Detecting Agent vs. Human Submissions

In form submit handlers, `e.agentInvoked` tells you whether the submission came from an agent or a human:

```javascript
form.addEventListener("submit", (e) => {
  if (e.agentInvoked) {
    // This submission came from an AI agent — skip CAPTCHA, log differently, etc.
    trackAgentCheckout()
  }
})
```

### Tool Schema

Both APIs use JSON Schema v7 for input definitions — the same schema format used by Claude, GPT, and Gemini for function calling. This means agents can use the same schema understanding regardless of how they are accessing tools.

## Real-World Example: Shopify Checkout

Shopify has shipped a Checkout MCP server that works alongside WebMCP:

```json
{
  "jsonrpc": "2.0",
  "method": "checkout/create",
  "params": {
    "lineItems": [{ "variantId": "gid://shopify/ProductVariant/1", "quantity": 2 }],
    "buyerIdentity": { "email": "customer@example.com" }
  }
}
```

Agents can create checkout sessions, add items, update quantities, and complete purchases — all through a structured JSON-RPC 2.0 interface with Bearer token authentication.

## Current Status and Limitations

**As of March 2026**:
- Available in Chrome 146 **Canary only** (behind "Experimental Web Platform Features" flag)
- Chrome stable release expected mid-2026
- **Chrome-browser-specific** — does not work with Playwright, curl, CLI agents, API agents, or any non-Chrome browser
- W3C Draft Community Group Report — spec may still change before stable release
- Requires the agent to be running inside a Chrome browser session

## Why `@agentfriendly` Excludes WebMCP (ADR-002)

The majority of agent traffic today comes from non-Chrome contexts:
- Claude Code, Cursor, OpenCode — CLI tools making HTTP requests
- Playwright-based agents (browser-use, Agentic) — not limited to Chrome
- API agents — no browser at all
- Server-to-server agents — purely HTTP

WebMCP only benefits Chrome-native browser agents, which are a minority of current agent traffic. `webagents.md` + AHP MODE3 cover the same tool registration use case for all these environments.

A future `@agentfriendly/webmcp` plugin will be built after Chrome stable ships. It will not require changes to existing configurations.

## How to Manually Enable WebMCP Today (Without `@agentfriendly`)

1. Enable `chrome://flags/#enable-experimental-web-platform-features` in Chrome 146 Canary
2. Use the declarative API (add `toolname` attributes to forms) or the imperative API (`navigator.modelContext.registerTool()`)
3. Test with a WebMCP-aware agent framework

There is no npm package required for basic declarative API usage — it is pure HTML attributes. For the imperative API, the TypeScript types are available from the WebMCP spec repository.
