/**
 * E2E: x402 Monetization Flow (Layer 7)
 *
 * Tests the full payment challenge and verification flow:
 * - No payment → HTTP 402
 * - Wrong payment → HTTP 402
 * - Valid payment → HTTP 200 passthrough
 */
import { describe, it, expect } from "vitest";
import { AgentFriendlyMiddleware } from "../../src/middleware.js";
import type { AgentRequest } from "../../src/types/agent-request.js";

const WALLET = "0xAbCd1234567890abcdef1234567890abcdef1234";
const PRICE = "0.001";

function agentRequest(
  path: string,
  paymentHeader?: string,
): AgentRequest {
  const headers: Record<string, string> = { "user-agent": "GPTBot/1.0" };
  if (paymentHeader) headers["x-payment"] = paymentHeader;
  return {
    method: "GET",
    url: `https://example.com${path}`,
    path,
    headers,
    body: null,
    query: {},
    ip: null,
  };
}

function makePaymentToken(options: {
  to: string;
  amount: number;
  network: string;
}): string {
  return Buffer.from(JSON.stringify(options)).toString("base64");
}

describe("E2E: x402 Monetization — payment challenge", () => {
  const sdk = new AgentFriendlyMiddleware({
    monetization: {
      enabled: true,
      walletAddress: WALLET,
      network: "base-mainnet",
      routes: {
        "/api/premium": { price: PRICE, network: "base-mainnet" },
        "/api/**": { price: "0.0001", network: "base-mainnet" },
      },
      exempt: ["/api/free"],
    },
  });

  it("returns 402 for monetized route without X-Payment header", async () => {
    const result = await sdk.process(agentRequest("/api/premium"));
    expect(result.earlyResponse!.status).toBe(402);
    expect(result.earlyResponse!.headers["Accept-Payment"]).toBe("x402/v1");
    expect(result.earlyResponse!.headers["X-Payment-Required"]).toBeTruthy();
    const paymentTerms = JSON.parse(
      result.earlyResponse!.headers["X-Payment-Required"],
    );
    expect(paymentTerms.accepts[0].network).toBe("base-mainnet");
  });

  it("returns 402 body with payment instructions", async () => {
    const result = await sdk.process(agentRequest("/api/premium"));
    expect(result.earlyResponse!.body).toContain("Payment Required");
    expect(result.earlyResponse!.body).toContain("USDC");
    expect(result.earlyResponse!.body).toContain("x402");
  });

  it("allows exempt route without payment", async () => {
    const result = await sdk.process(agentRequest("/api/free"));
    expect(result.earlyResponse?.status).not.toBe(402);
  });

  it("allows non-agent requests without payment check", async () => {
    const humanRequest: AgentRequest = {
      method: "GET",
      url: "https://example.com/api/premium",
      path: "/api/premium",
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        cookie: "session=abc123",
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "navigate",
        "sec-fetch-user": "?1",
        "sec-fetch-dest": "document",
        referer: "https://example.com/",
      },
      body: null,
      query: {},
      ip: null,
    };
    const result = await sdk.process(humanRequest);
    // Human requests are never subject to x402 monetization
    expect(result.context.tier).toBe("human");
    expect(result.earlyResponse?.status).not.toBe(402);
  });
});

describe("E2E: x402 Monetization — payment verification", () => {
  const sdk = new AgentFriendlyMiddleware({
    monetization: {
      enabled: true,
      walletAddress: WALLET,
      network: "base-mainnet",
      routes: { "/api/**": { price: PRICE, network: "base-mainnet" } },
    },
  });

  it("returns 402 for invalid payment token (wrong amount)", async () => {
    const badToken = makePaymentToken({
      to: WALLET.toLowerCase(),
      amount: 1, // too small (1 micro-USDC vs 1000 required for $0.001)
      network: "base-mainnet",
    });
    const result = await sdk.process(agentRequest("/api/data", badToken));
    expect(result.earlyResponse!.status).toBe(402);
  });

  it("returns 402 for invalid payment token (wrong address)", async () => {
    const badToken = makePaymentToken({
      to: "0x0000000000000000000000000000000000000000",
      amount: 1000,
      network: "base-mainnet",
    });
    const result = await sdk.process(agentRequest("/api/data", badToken));
    expect(result.earlyResponse!.status).toBe(402);
  });

  it("allows request with valid payment proof", async () => {
    const validToken = makePaymentToken({
      to: WALLET.toLowerCase(),
      amount: 1000, // 0.001 USDC = 1000 micro-USDC
      network: "base-mainnet",
    });
    const result = await sdk.process(agentRequest("/api/data", validToken));
    expect(result.earlyResponse).toBeNull();
  });
});
