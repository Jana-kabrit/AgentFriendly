import { describe, it, expect } from "vitest";

import { findMatchingPricing, generate402Response } from "../../src/monetization/x402.js";
import type { MonetizationConfig, X402RouteConfig } from "../../src/types/config.js";

const SAMPLE_ROUTES: Record<string, X402RouteConfig> = {
  "GET /api/premium/**": { price: "$0.001", network: "base-mainnet" },
  "POST /agent/task": { price: "$0.01", network: "base-mainnet" },
  "/api/reports": { price: "0.005", network: "base-mainnet" },
};

describe("findMatchingPricing", () => {
  it("matches a GET route with method prefix", () => {
    const result = findMatchingPricing("GET", "/api/premium/reports", SAMPLE_ROUTES, []);
    expect(result).not.toBeNull();
    expect(result?.price).toBe("$0.001");
  });

  it("matches a POST route", () => {
    const result = findMatchingPricing("POST", "/agent/task", SAMPLE_ROUTES, []);
    expect(result).not.toBeNull();
    expect(result?.price).toBe("$0.01");
  });

  it("does not match a GET to a POST-only route", () => {
    const result = findMatchingPricing("GET", "/agent/task", SAMPLE_ROUTES, []);
    expect(result).toBeNull();
  });

  it("matches a route without method prefix", () => {
    const result = findMatchingPricing("GET", "/api/reports", SAMPLE_ROUTES, []);
    expect(result).not.toBeNull();
  });

  it("returns null for unmatched routes", () => {
    const result = findMatchingPricing("GET", "/public/homepage", SAMPLE_ROUTES, []);
    expect(result).toBeNull();
  });

  it("returns null for exempt agents", () => {
    const result = findMatchingPricing("GET", "/api/premium/data", SAMPLE_ROUTES, [
      "claude-code",
      "/api/premium/**", // exempt this entire path
    ]);
    // Path is in exempt list
    expect(result).toBeNull();
  });
});

describe("generate402Response", () => {
  const config: MonetizationConfig = {
    enabled: true,
    walletAddress: "0x1234567890abcdef",
    network: "base-mainnet",
  };

  const pricing: X402RouteConfig = {
    price: "$0.001",
    network: "base-mainnet",
  };

  it("returns a 402 response", () => {
    const response = generate402Response(config, pricing, "/api/premium/data");
    expect(response.handled).toBe(true);
    expect(response.status).toBe(402);
  });

  it("includes Accept-Payment header", () => {
    const response = generate402Response(config, pricing, "/api/premium/data");
    expect(response.headers["Accept-Payment"]).toBe("x402/v1");
  });

  it("includes machine-readable payment terms in X-Payment-Required", () => {
    const response = generate402Response(config, pricing, "/api/premium/data");
    const paymentTerms = JSON.parse(response.headers["X-Payment-Required"] ?? "{}") as Record<string, unknown>;
    expect(paymentTerms["version"]).toBe("1");
    expect(Array.isArray(paymentTerms["accepts"])).toBe(true);
  });

  it("includes human-readable markdown body", () => {
    const response = generate402Response(config, pricing, "/api/premium/data");
    expect(typeof response.body).toBe("string");
    expect(response.body).toContain("Payment Required");
    expect(response.body).toContain("x402");
  });

  it("uses the wallet address from pricing.to if provided", () => {
    const customPricing: X402RouteConfig = {
      ...pricing,
      to: "0xabcdef1234567890",
    };
    const response = generate402Response(config, customPricing, "/api/premium/data");
    const paymentTerms = JSON.parse(response.headers["X-Payment-Required"] ?? "{}") as {
      accepts: Array<{ to: string }>;
    };
    expect(paymentTerms.accepts[0]?.to).toBe("0xabcdef1234567890");
  });
});
