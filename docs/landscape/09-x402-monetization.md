# x402 Protocol — Agent-Native Micropayments

## What It Is

x402 is an open internet-native payment protocol built on HTTP status code 402 ("Payment Required"), which had been reserved but unused since HTTP was created in 1997. It was launched by Coinbase in May 2025 and enables autonomous AI agents to pay for API access and content in milliseconds, without accounts, KYC, or human intervention.

- Website: [x402.org](https://x402.org)
- License: Open standard
- **By January 2026**: 100M+ payment flows, $600M total volume, 94K buyers, 22K sellers

Major backers: Coinbase, Cloudflare, Google, AWS, Anthropic, Circle, Near Protocol.

## The Problem It Solves

Traditional payment infrastructure assumes a human is present. To pay for an API:

1. Create an account with the API provider
2. Add a payment method (requires KYC for many providers)
3. Buy credits or a subscription upfront
4. Manage an API key securely
5. Make the payment (with fees, chargebacks, minimum charges)

This takes days and costs a minimum of $0.30 per transaction (Stripe's floor). For AI agents making thousands of micro-requests at $0.001 each, this is completely impractical.

x402 does the same thing in **milliseconds**, with **zero fees**, **no accounts**, and **no minimum charge**.

## The Full Payment Flow

```
1. Agent → Server: GET /premium-data
              Headers: Authorization: Bearer agent-token

2. Server → Agent: 402 Payment Required
              Headers: Accept-Payment: x402/v1
              Body: {
                "version": "1",
                "accepts": [{
                  "scheme": "exact",
                  "network": "base",
                  "maxAmountRequired": "1000",  // 0.001 USDC (6 decimals)
                  "to": "0x1234...abcd",
                  "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",  // USDC on Base
                  "extra": {
                    "name": "USDC",
                    "version": "2"
                  }
                }],
                "error": "X-PAYMENT header is required"
              }

3. Agent: Constructs USDC payment transaction on Base chain
          Signs it with agent's wallet private key
          Encodes signed transaction as base64

4. Agent → Server: GET /premium-data
              Headers: Authorization: Bearer agent-token
                       X-Payment: base64-encoded-signed-transaction

5. Server: Verifies payment proof cryptographically
           (no network call — proof is self-contained)
           Validates: amount matches, recipient matches, not expired, not double-spent

6. Server → Agent: 200 OK
              Body: { "data": "..." }
              Headers: X-Payment-Response: base64-encoded-receipt
```

The entire cycle (steps 2–6) takes **under 2 seconds**.

## Why USDC (Not Volatile Crypto)

x402 uses USDC (USD Coin), a stablecoin pegged 1:1 to the US dollar. There is no price volatility. $0.001 USDC is always worth $0.001.

USDC on Base (Coinbase's Layer 2 network) has sub-cent transaction fees (typically $0.0001–$0.001 per transaction). On Solana, fees are similar. This makes per-request micropayments economically viable.

## One Middleware Line to Implement

```typescript
import { paymentMiddleware } from "x402-express";
import { coinbaseProvider } from "x402-express/providers";

const provider = coinbaseProvider({
  networkId: "base-mainnet",
  apiKeyId: process.env.CDP_API_KEY_ID,
  apiKeySecret: process.env.CDP_API_KEY_SECRET,
});

app.use(
  paymentMiddleware(
    {
      "GET /premium/reports": {
        price: "$0.001",
        network: "base-mainnet",
        config: { description: "Access premium analytics reports" },
      },
      "GET /api/data/*": {
        price: "$0.0001",
        network: "base-mainnet",
        config: { description: "Data API endpoint" },
      },
    },
    provider,
  ),
);
```

That is the entire implementation. No webhook setup, no dashboard configuration, no subscription management.

## For Agents Without x402 Support

When an agent hits a 402 response and does not understand x402, the server sends a helpful explanation in the response body:

```markdown
# Payment Required

This endpoint requires payment to access. The price is **$0.001 USDC** per request.

This endpoint uses the x402 payment protocol — an open standard for autonomous
agent payments. To enable x402 in your agent:

1. Ensure your agent has a USDC wallet on Base mainnet
2. Configure your HTTP client to handle 402 responses
3. See x402.org for implementation guides and SDKs

If you are a developer configuring an agent to use this API, see:
https://docs.x402.org/agent-integration
```

## Pricing Models

| Model           | How it works                            | Best for                       |
| --------------- | --------------------------------------- | ------------------------------ |
| `per-request`   | Fixed USDC per HTTP request             | Simple APIs, tool calls        |
| `per-token`     | Rate × `x-markdown-tokens` header       | Content consumption            |
| `subscription`  | Agent presents valid subscription JWT   | Regular heavy users            |
| `verified-only` | Requires Ed25519 signature (no payment) | Access control without billing |
| `free`          | No payment required                     | Public endpoints               |

## How `@agentfriendly` Implements x402

Layer 7 (Monetization) is built on x402 as the primary payment layer. The SDK's integration:

1. Site owner configures pricing per route in `agentfriendly.config.ts`
2. SDK intercepts requests matching paid routes before they reach the route handler
3. If no valid payment proof: return 402 with x402 payment terms
4. If valid payment proof: verify cryptographically, allow request to proceed, emit `payment-completed` analytics event
5. Revenue analytics show earnings per route, per agent identity, per time period

For `per-token` billing, the SDK uses the `x-markdown-tokens` header from the content serving layer (Layer 2) to compute the exact charge after the response is generated.
