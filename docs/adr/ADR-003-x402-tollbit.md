# ADR-003: x402 as Primary Monetization, TollBit as Fallback

**Status**: Accepted  
**Date**: March 2026

## Context

Site owners want to monetize agent traffic. Three categories of solution exist:

1. **Protocol-level**: x402 (HTTP 402 + stablecoin micropayments)
2. **SaaS-level**: TollBit, Agentis, Paywalls.ai (external services handling billing)
3. **Traditional**: Stripe, PayPal (designed for human payment flows)

## Options Considered

**Option A: Stripe integration**  
Familiar to developers. Requires account creation, KYC, webhook setup, subscription or invoice model. Minimum charge floors (~$0.30) are too high for per-request micropayments. Autonomous agents cannot complete Stripe's payment flows (redirect to Stripe Checkout, etc.) without human intervention.

**Option B: TollBit only**  
Zero crypto required. Routes bot traffic to paywall subdomain. No revenue share. But requires signing up for a third-party SaaS. Revenue visibility is in TollBit's dashboard, not your own.

**Option C: x402 only**  
Zero protocol fees. Sub-cent micropayments. Self-contained payment verification (no network call at verify-time). But requires a USDC wallet — a barrier for many developers unfamiliar with crypto.

**Option D: x402 as primary, TollBit as fallback, neither Stripe**  
Covers both crypto-native and traditional publishers. x402 handles the agent-native payment flow with no friction. TollBit handles publishers not ready for stablecoins.

## Decision

**Option D: x402 primary, TollBit compatibility mode as fallback.**

## Rationale

**Why x402**:

- The only open, internet-native, agent-native payment protocol. Zero protocol fees. Zero KYC. Zero account setup for agents.
- USDC is a stablecoin (pegged to USD). Price volatility is not a concern.
- By January 2026: 100M+ payment flows, $600M volume. Backers include Cloudflare, Google, AWS, Anthropic, and Circle. This is not speculative — it is in production at scale.
- Payment proof verification is cryptographically self-contained: the server verifies the proof without making an external network call, so there is no latency penalty or availability dependency.
- One middleware line to add: `app.use(paymentMiddleware({ "GET /premium/**": { amount: "0.001", currency: "USDC" } }))`.

**Why TollBit as fallback (not Stripe)**:

- TollBit requires zero crypto from the publisher. Revenue is in USD, paid out via bank transfer.
- TollBit uses CDN-level user-agent routing — it does not require modifying your app code, only DNS configuration. The SDK emits TollBit-compatible headers when `monetization.fallback: "tollbit"` is set.
- Stripe cannot be used for autonomous agent micropayments. The payment initiation flow requires a human to complete.

## Consequences

- Publishers using x402 must have a USDC wallet (Coinbase or compatible). The `agentfriendly init` CLI wizard guides them through this.
- Agents without x402 support receive an informative `text/markdown` body in the 402 response explaining what x402 is and how to enable it.
- TollBit fallback requires a separate TollBit account and DNS configuration. The SDK does not handle this automatically — it only emits the headers and redirects.
