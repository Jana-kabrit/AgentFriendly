# Layer 7: Monetization (x402)

The monetization layer enables websites to charge AI agents for access to specific content or tools. It is built on the [x402 protocol](https://x402.org) — an open standard that uses HTTP 402 and stablecoin micropayments to create a permissionless payment layer for the web.

## Why x402?

| Option | Tradeoff |
|--------|---------|
| x402 (on-chain USDC) | Open standard, no intermediary, works for any agent that implements x402 |
| TollBit | SaaS paywall, requires agent operators to pre-register with TollBit, but has better coverage for agents that don't support x402 |
| API keys / subscriptions | Requires account creation — incompatible with autonomous agent sessions |

The SDK implements x402 as the primary mechanism and TollBit as a fallback (ADR-003). Human users are never affected by the monetization layer.

---

## HTTP 402 Flow

```
Agent → GET /premium-report

Server → 402 Payment Required
         X-Payment: {"x402Version":"1","accepts":[{"scheme":"exact","network":"base-mainnet","maxAmountRequired":"1000","resource":"https://example.com/premium-report","description":"Access to premium report","mimeType":"text/markdown","payTo":"0xYourAddress","maxTimeoutSeconds":300,"asset":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","extra":{"name":"USDC on Base","version":"1"}}]}

Agent → pays 1000 USDC units ($0.001) on-chain
        GET /premium-report
        X-Payment-Response: {"x402Version":"1","scheme":"exact","network":"base-mainnet","payload":"0x...","payer":"0xAgentWallet"}

Server → 200 OK
         X-Payment-Receipt: "0x..."
```

---

## Pricing Configuration

```typescript
monetization: {
  enabled: true,
  receivingAddress: "0xYourWalletAddress",
  defaultCurrency: "USDC",
  network: "base-mainnet",

  pricingRules: [
    {
      path: "/premium/**",
      amount: 0.001,      // $0.001 USDC per request
      currency: "USDC",
      description: "Access to premium content",
    },
    {
      path: "/api/search",
      amount: 0.0001,
      currency: "USDC",
      description: "Per-search fee",
    },
  ],
}
```

`amount` is always in human-readable USDC units (e.g., `0.001` = $0.001). The SDK converts to the correct token denomination internally.

---

## Payment Verification

When an agent submits an `X-Payment-Response` header, the SDK verifies:

1. **Schema validation**: Is the JSON well-formed and correct version?
2. **Network match**: Does the `network` field match the configured network?
3. **Amount check**: Is `maxAmountRequired` ≥ the rule's configured amount?
4. **Address match**: Does `payTo` match `receivingAddress`?
5. **Signature verification**: Is the payment payload a valid on-chain proof?

Step 5 requires a call to the blockchain RPC. In the current implementation, verification is **pluggable** — you can inject a custom `PaymentVerifier` to use any on-chain verification service.

---

## Who Pays?

Only requests matching the configured `pricingRules` are subject to payment. All other requests (including human browser requests) pass through without any payment challenge.

The `tier` check is implicit: if the request is `"human"`, Layer 0 exits the pipeline before Layer 7 is reached.

---

## TollBit Fallback

Some agent operators (especially enterprise deployments) may not support on-chain payments. The TollBit fallback issues a TollBit-compatible challenge header alongside the x402 response:

```typescript
monetization: {
  tollbitFallback: {
    enabled: true,
    apiKey: process.env.TOLLBIT_API_KEY!,
  },
}
```

When enabled, the 402 response includes both an `X-Payment` (x402) and a `Tollbit-Challenge` header.

---

## Supported Networks

| Network | Currency | Notes |
|---------|----------|-------|
| `base-mainnet` | USDC | Primary recommendation — low fees (~$0.0001/tx) |
| `base-sepolia` | USDC | Testnet for development |
| `solana-mainnet` | USDC | Higher throughput, different SPL token address |
| `ethereum-mainnet` | USDC | High fees — only suitable for larger payments |

Multiple networks can be listed in `accepts[]` of the 402 response. The agent chooses which network to pay on.

---

## No-op for Humans

The monetization layer is completely invisible to human users:
- Browsers never receive a 402 response.
- The payment challenge is only issued to requests with `tier != "human"`.
- No cookies, redirects, or UI changes are involved.
