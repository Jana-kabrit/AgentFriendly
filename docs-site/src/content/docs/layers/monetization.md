---
title: "Layer 7: x402 Monetization"
description: Charge AI agents per request using the x402 open micropayments standard.
---

# Layer 7: x402 Monetization

AgentFriendly implements the [x402 protocol](https://x402.org) — an open standard for HTTP-native micropayments using USDC stablecoins on Base (Ethereum L2) and Solana.

## Why Monetize Agent Access?

AI agents can consume your content at a scale that would be prohibitively expensive for a human:

- A single training run might crawl your entire site millions of times.
- API agents may call your tools thousands of times per session.
- Search bots may re-index your content hourly.

x402 lets you charge a fraction of a cent per request — making agent access economically sustainable while remaining negligible for legitimate use cases.

## Setup

```typescript
createAgentFriendlyMiddleware({
  monetization: {
    enabled: true,
    walletAddress: "0xYourWalletAddress", // USDC receiving address
    network: "base-mainnet", // "base-mainnet" | "base-sepolia" | "solana-mainnet"
    routes: {
      // Charge $0.001 USDC for any /api/** request
      "/api/**": { price: "0.001" },

      // Charge $0.01 for premium content
      "GET /premium/**": { price: "0.01", description: "Premium content access" },

      // Different wallet for a specific route
      "/enterprise/**": {
        price: "0.10",
        to: "0xEnterpriseWallet",
        network: "base-mainnet",
      },
    },
    // Routes exempt from payment
    exempt: ["/api/free", "/llms.txt", "/.well-known/**"],

    // Fallback to TollBit for agents that don't support x402
    fallback: false,
  },
});
```

## The x402 Flow

1. Agent makes request to monetized route **without** `X-Payment` header.
2. Server responds with **HTTP 402**:
   ```
   HTTP/1.1 402 Payment Required
   Content-Type: text/markdown
   Accept-Payment: x402/v1
   X-Payment-Required: {"version":"1","accepts":[{"scheme":"exact","network":"base-mainnet",...}]}
   ```
3. Agent's x402 client pays the required amount and retries with `X-Payment` header:
   ```
   GET /api/premium HTTP/1.1
   X-Payment: base64EncodedPaymentProof
   ```
4. Server verifies the payment proof and serves the response.

## Payment Proof Verification

AgentFriendly verifies the `X-Payment` header by checking:

- The `to` address matches your configured wallet.
- The `amount` is at least the required price (in USDC micro-units: 1 USDC = 1,000,000).
- The `network` matches the configured network.

For full on-chain verification in production, integrate with the x402 Verifier Service.

## Route Patterns

Route patterns follow the format `[METHOD] /path/pattern`:

```typescript
routes: {
  "/api/**": { price: "0.001" },          // All methods, /api/**
  "GET /search": { price: "0.0001" },     // GET only, /search
  "POST /generate/**": { price: "0.01" }, // POST only, /generate/**
}
```

## Supported Networks

| Network          | USDC Contract | Use Case           |
| ---------------- | ------------- | ------------------ |
| `base-mainnet`   | `0x833589...` | Production mainnet |
| `base-sepolia`   | `0x036CbD...` | Testing            |
| `solana-mainnet` | `EPjFWdd...`  | Solana ecosystem   |

## 402 Response Body

```markdown
# Payment Required

**Price**: $0.0010 USDC per request
**Network**: base-mainnet
**Protocol**: [x402](https://x402.org) — open internet-native micropayments

## How to Pay

Retry this request with the `X-Payment` header set to your signed payment proof.
```

## Testing Payments

```bash
# Simulate an x402 payment locally
curl -H "User-Agent: GPTBot/1.0" http://localhost:3000/api/premium
# → 402 Payment Required

# Use the x402 test client
npx x402-cli pay --url http://localhost:3000/api/premium --wallet test-wallet
```
