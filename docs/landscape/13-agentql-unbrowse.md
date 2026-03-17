# AgentQL and Unbrowse — Automated Web-to-API Conversion

## AgentQL

- Website: [agentql.com](https://agentql.com)
- GitHub: [github.com/tinyfish-io/agentql](https://github.com/tinyfish-io/agentql)
- Pricing: API-based, usage metered
- SDKs: Python, JavaScript (Playwright integration)

### What It Is

AgentQL is a query language for web pages. Instead of writing CSS selectors or XPath queries that break when the site redesigns, you write natural language queries and AgentQL's AI figures out which elements you mean.

```python
import agentql
from playwright.sync_api import sync_playwright

with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    page = agentql.wrap(browser.new_page())
    page.goto("https://shop.example.com/products")

    # Natural language query — no CSS selectors
    response = page.query_elements("""
    {
        products[] {
            name
            price
            rating
            add_to_cart_button
        }
    }
    """)

    for product in response.products:
        print(f"{product.name}: ${product.price}")
        if product.rating > 4.5:
            product.add_to_cart_button.click()
```

AgentQL uses a semantic understanding of the page to find elements regardless of their CSS class names, IDs, or HTML structure. It "self-heals" — when a site redesigns, the query often still works because AgentQL understands the intent ("find the add to cart button") rather than the exact DOM structure.

### Key Features

- **Self-healing selectors**: Queries survive site redesigns
- **Playwright integration**: Drop-in replacement for Playwright's `page.query_selector()`
- **REST API**: For agents that are not browser-based, AgentQL provides a REST API that takes a URL + query and returns the extracted data
- **Authenticated sites**: Can handle sites that require login
- **Dynamic content**: Full Chromium browser, so JavaScript-heavy SPAs are handled

### The AgentQL Query Language

```
{
    search_bar
    products[] {
        title
        price {
            amount
            currency
        }
        in_stock
        buy_button
    }
    pagination {
        next_page_button
        current_page_number
    }
}
```

This query finds the search bar, all products with their titles, prices, stock status, and buy buttons, plus the pagination controls — regardless of the page's HTML structure.

---

## Unbrowse

- Website: [unbrowse.ai](https://unbrowse.ai)
- Status: Early-stage startup (as of March 2026)

### What It Is

Unbrowse automatically reverse-engineers websites into APIs. You point it at a website, and it:

1. Crawls the site
2. Identifies the underlying API calls the site makes to its backend
3. Captures authentication flows
4. Generates a structured API definition that agents can call directly

Instead of simulating browser interactions, agents call the API Unbrowse discovered. This is faster, more reliable, and less resource-intensive than browser automation.

Unbrowse also learns "skills" — reusable task sequences shared in a marketplace. When one Unbrowse user captures how to perform a task on a site, the skill is shared with all users.

### How It Works (Technically)

Unbrowse instruments a browser session (likely using Chrome DevTools Protocol) to intercept all XHR/fetch calls the website makes. It records:

- API endpoint URLs
- Request parameters
- Authentication headers (sanitized)
- Response schemas

This creates an OpenAPI-compatible spec for the site's real backend API.

---

## Who These Tools Target

Both AgentQL and Unbrowse target **agent developers** who need to interact with sites that do not expose native agent-friendly interfaces.

They are solving the problem from the **consumption side** (the agent's perspective). `@agentfriendly` solves the problem from the **production side** (the site owner's perspective).

| Perspective     | Tool               | Approach                                |
| --------------- | ------------------ | --------------------------------------- |
| Agent developer | AgentQL            | Query the DOM with AI-powered selectors |
| Agent developer | Unbrowse           | Discover and call the site's real API   |
| Agent developer | Firecrawl/Jina     | Extract clean text content from HTML    |
| Site owner      | **@agentfriendly** | Expose native agent-friendly interfaces |

## The Key Limitation

Both AgentQL and Unbrowse require a browser session or reverse-engineering to function. They are:

- **Slower**: Browser startup, page load, rendering
- **Fragile**: Sites can detect and block automated browsers; Unbrowse-discovered APIs may not be public
- **Uncooperative**: The site has not consented to being accessed this way
- **Read-biased**: Complex state-changing operations are harder to automate reliably

## How `@agentfriendly` Makes Them Unnecessary

When a site implements `@agentfriendly`:

- **AgentQL is unnecessary** — tools are declared with clean JSON Schema v7 definitions. No DOM querying needed.
- **Unbrowse is unnecessary** — the site explicitly exposes its tool interface at `/.well-known/agent-tools.json`. There is nothing to reverse-engineer.
- **Both are unnecessary** — the site welcomes agent access, declares what agents can do, and provides structured interfaces for doing it.

The existence of these tools is evidence of demand. Sites that do not provide native agent interfaces are creating a market for workaround tooling. `@agentfriendly` collapses that workaround market for the sites that use it.
