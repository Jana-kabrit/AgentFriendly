# TollBit — Per-Page AI Agent Paywall

## What It Is

TollBit is a SaaS platform that enables publishers and website owners to monetize AI bot and agent access to their content through per-page usage-based pricing.

- Website: [tollbit.com](https://tollbit.com)
- Target: Publishers, content sites, documentation sites
- Revenue model: Publishers keep 100% of their set rate; TollBit charges AI customers a small transaction fee

## How It Works

### The Core Concept

TollBit creates a paywall specifically for bot traffic. Human visitors get your normal website. Bot traffic is identified and routed to a TollBit-managed endpoint where payment is required for access.

### Technical Implementation

**Step 1**: TollBit provisions a paywall subdomain for your site (`api.yoursite.com` or `bot.yoursite.com`).

**Step 2**: Bot traffic is identified at the CDN level via user-agent strings. Since bots typically do not execute JavaScript, CDN-level user-agent detection is reliable.

**Step 3**: Identified bot traffic is redirected to the TollBit paywall subdomain.

**Step 4**: AI companies (OpenAI, Anthropic, Perplexity, etc.) that want access to your content go through TollBit's marketplace to purchase a license.

**Step 5**: When a licensed AI system requests your content, TollBit verifies the license, delivers the content, and processes the payment — all transparently.

### Pricing Configuration

Publishers set rates through the TollBit dashboard:

- **By bot**: Different rates for GPTBot vs. PerplexityBot vs. ClaudeBot
- **By page**: Higher rates for premium content, lower for general pages
- **By keyword**: Higher rates when content contains specific high-value terms
- **By directory**: `/premium/**` costs more than `/blog/**`
- **By time**: Time-of-day or seasonal pricing

Rates can be adjusted at any time without renegotiating contracts. As AI traffic and value grow, publishers increase rates incrementally.

### Two License Types

**Full Display**: The AI system may display the full content of your article (e.g., to end users in a chat interface).

**Summarization**: The AI system may summarize or cite your content but not display it in full. This is typically cheaper.

## Who Pays TollBit

AI companies pay TollBit for access to your content. TollBit handles:
- License negotiation with AI companies
- Payment collection from AI companies
- Passing the rate you set through to you (minus their transaction fee)
- Legal and compliance (license agreements between publisher and AI company)

## Who Uses It

TollBit is primarily designed for:
- News publishers and media organizations
- Blog networks and content sites
- Documentation sites where AI companies want to index content for RAG

It is less suited for interactive SaaS applications where agents need to perform actions (not just read content), since TollBit only controls read access via the paywall subdomain.

## Limitations

- **SaaS dependency**: Your monetization is dependent on TollBit's platform. If TollBit changes pricing, shuts down, or is acquired, you may need to migrate.
- **Content-only**: TollBit monetizes content access (reading). It does not monetize API calls, tool invocations, or task executions.
- **Not agent-to-site payments**: Payments flow from AI companies to TollBit to publishers. It is a licensing model, not a per-request micropayment model.
- **Not open**: The pricing, license formats, and payment rails are proprietary to TollBit.

## How `@agentfriendly` Uses TollBit

TollBit is the **fallback monetization mode** for publishers not ready for x402 (stablecoin payments).

When `monetization.fallback: "tollbit"` is set in the config:

1. The SDK identifies bot traffic using Layer 0 (trust tier detection)
2. For bot traffic hitting monetized routes, the SDK emits TollBit-compatible response headers
3. Optionally, the SDK redirects bot traffic to the configured TollBit paywall subdomain

This lets publishers benefit from the SDK's full feature set (analytics, access control, identity verification, tool registration, multi-tenancy) while using TollBit as their content monetization layer.

The SDK does not handle TollBit payments or licensing — it only integrates at the traffic routing level.
