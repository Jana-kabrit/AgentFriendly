"""
Layer 7 — x402 Payment Middleware (Python)

Mirrors packages/core/src/monetization/x402.ts
"""

from __future__ import annotations

import fnmatch
import json
from decimal import Decimal

from ..config import MonetizationConfig, X402RouteConfig
from ..middleware import EarlyResponse
from ..types import AgentContext

USDC_DECIMALS = 6

USDC_CONTRACTS = {
    "base-mainnet": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "solana-mainnet": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
}


def _parse_price(price: str | float) -> int:
    """Convert a human-readable price to USDC base units."""
    num_str = str(price).replace("$", "")
    return int(Decimal(num_str) * Decimal(10**USDC_DECIMALS))


def find_matching_pricing(
    method: str,
    path: str,
    routes: dict[str, X402RouteConfig],
    exempt: list[str],
) -> X402RouteConfig | None:
    """Find the pricing config for the current request, or None if not monetized."""
    for exempt_pattern in exempt:
        if fnmatch.fnmatch(path, exempt_pattern) or exempt_pattern in path:
            return None

    for route_pattern, pricing in routes.items():
        parts = route_pattern.strip().split(None, 1)
        if len(parts) == 2 and parts[0].isupper():
            pattern_method, pattern_path = parts
            if pattern_method != method.upper():
                continue
        else:
            pattern_path = parts[0]

        if fnmatch.fnmatch(path, pattern_path):
            return pricing

    return None


def generate_402_response(
    config: MonetizationConfig,
    pricing: X402RouteConfig,
    path: str,
) -> EarlyResponse:
    """Generate an HTTP 402 Payment Required response."""
    wallet = pricing.to or config.wallet_address or ""
    network = pricing.network or config.network or "base-mainnet"
    amount_micro = _parse_price(pricing.price)
    usdc_contract = USDC_CONTRACTS.get(network, USDC_CONTRACTS["base-mainnet"])

    payment_terms = {
        "version": "1",
        "accepts": [
            {
                "scheme": "exact",
                "network": network,
                "maxAmountRequired": str(amount_micro),
                "to": wallet,
                "asset": usdc_contract,
                "extra": {"name": "USDC", "version": "2"},
            }
        ],
        "error": "X-PAYMENT header is required to access this resource",
    }

    human_amount = f"{amount_micro / 10 ** USDC_DECIMALS:.4f}"
    body = "\n".join([
        "# Payment Required",
        "",
        f"**Price**: ${human_amount} USDC per request",
        f"**Network**: {network}",
        "**Protocol**: [x402](https://x402.org) — open internet-native micropayments",
        "",
        "## How to Pay",
        "",
        "Retry this request with the `X-Payment` header set to your signed payment proof.",
        "",
    ])

    return EarlyResponse(
        status=402,
        headers={
            "Content-Type": "text/markdown; charset=utf-8",
            "Accept-Payment": "x402/v1",
            "X-Payment-Required": json.dumps(payment_terms),
        },
        body=body,
        content_type="text/markdown",
    )


def check_monetization(
    context: AgentContext,
    config: MonetizationConfig,
    headers: dict[str, str],
) -> EarlyResponse | None:
    """Check monetization requirements. Returns 402 EarlyResponse or None."""
    if not config.enabled or not context.is_agent:
        return None

    pricing = find_matching_pricing(
        context.method, context.path, config.routes, config.exempt
    )
    if not pricing:
        return None

    payment_header = headers.get("x-payment")
    if not payment_header:
        return generate_402_response(config, pricing, context.path)

    # Structural verification
    try:
        decoded = json.loads(
            __import__("base64").b64decode(payment_header).decode()
        )
        amount = int(decoded.get("amount", 0))
        required = _parse_price(pricing.price)
        to = str(decoded.get("to", "")).lower()
        required_to = (pricing.to or config.wallet_address or "").lower()
        network = decoded.get("network", "")

        if to != required_to or amount < required or network != (pricing.network or "base-mainnet"):
            return generate_402_response(config, pricing, context.path)
    except Exception:
        return generate_402_response(config, pricing, context.path)

    return None
