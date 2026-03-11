"""
Layer 0 — Detection Pipeline

Orchestrates all 4 signals and resolves a TrustTier for each request.
Mirrors packages/core/src/detection/pipeline.ts
"""

from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone

from ..config import DetectionConfig
from ..types import AgentContext, AgentEntry, TraceEntry, TrustTier, DetectionSignal
from .signal_accept_header import analyze_accept_header
from .signal_header_heuristics import run_header_heuristics
from .signal_ua_database import check_ua_database


def _resolve_tier(
    signals: list[str],
    is_verified: bool,
    is_known: bool,
    is_suspected: bool,
    requested_markdown: bool,
) -> tuple[TrustTier, str]:
    """Resolve the trust tier from collected signals."""
    if is_verified:
        return "verified-agent", "Cryptographic identity verification passed"
    if is_known:
        return "known-agent", f"UA matched database (signals: {', '.join(signals)})"
    if is_suspected or (requested_markdown and not is_known):
        return "suspected-agent", f"Heuristic signals detected (signals: {', '.join(signals)})"
    return "human", "No agent signals detected"


async def run_detection_pipeline(
    *,
    method: str,
    path: str,
    headers: dict[str, str],
    config: DetectionConfig | None = None,
) -> AgentContext:
    """
    Run the full detection pipeline for a single request.
    Returns a fully-populated AgentContext.

    Async because identity verification may require a network call
    to fetch the agent operator's public key (cached after first fetch).
    """
    cfg = config or DetectionConfig()
    start_time = time.monotonic()
    all_signals: list[str] = []

    # -------------------------------------------------------------------------
    # Signal 1: Accept Header
    # -------------------------------------------------------------------------
    accept_result = analyze_accept_header(headers.get("accept"))
    if accept_result.has_agent_signal:
        all_signals.extend(accept_result.signals)

    # -------------------------------------------------------------------------
    # Signal 2: UA Database
    # -------------------------------------------------------------------------
    ua_result = check_ua_database(
        headers.get("user-agent"), cfg.custom_agents or None
    )
    matched_agent: AgentEntry | None = None
    agent_category = None
    if ua_result.matched and ua_result.match:
        all_signals.extend(ua_result.signals)
        matched_agent = ua_result.match.entry
        agent_category = ua_result.match.entry.category

    # -------------------------------------------------------------------------
    # Signal 3: Header Heuristics
    # -------------------------------------------------------------------------
    heuristics_is_suspected = False
    if cfg.header_heuristics:
        heuristics_result = run_header_heuristics(headers)
        if heuristics_result.is_suspected:
            all_signals.extend(heuristics_result.signals)
            heuristics_is_suspected = True

    # -------------------------------------------------------------------------
    # Signal 4: Identity Verification (RFC 9421 / Clawdentity)
    # Currently Python-side performs structural verification only.
    # Full async Ed25519 verification is included when cryptography is installed.
    # -------------------------------------------------------------------------
    verified_identity = None
    has_sig_headers = "signature" in headers and "signature-input" in headers
    has_agent_token = (headers.get("authorization", "")).lower().startswith("agenttoken")

    if has_sig_headers:
        try:
            from .verifier_rfc9421 import verify_rfc9421_signature

            result = await verify_rfc9421_signature(
                method=method,
                url=f"https://placeholder{path}",
                headers=headers,
            )
            if result.valid and result.identity:
                all_signals.append("rfc9421-signature")
                verified_identity = result.identity
        except ImportError:
            pass  # cryptography package not installed

    elif has_agent_token and not verified_identity:
        try:
            from .verifier_clawdentity import verify_clawdentity_token

            result = await verify_clawdentity_token(headers.get("authorization"))
            if result.valid and result.identity:
                all_signals.append("clawdentity-ait")
                verified_identity = result.identity
        except ImportError:
            pass

    # -------------------------------------------------------------------------
    # Tier Resolution
    # -------------------------------------------------------------------------
    tier, reason = _resolve_tier(
        all_signals,
        is_verified=verified_identity is not None,
        is_known=ua_result.matched,
        is_suspected=heuristics_is_suspected,
        requested_markdown=accept_result.prefers_markdown,
    )

    is_agent = tier != "human"
    duration_ms = (time.monotonic() - start_time) * 1000

    context = AgentContext(
        request_id=str(uuid.uuid4()),
        received_at=datetime.now(timezone.utc).isoformat(),
        tier=tier,
        signals=list(all_signals),  # type: ignore[arg-type]
        is_agent=is_agent,
        user_agent=headers.get("user-agent", ""),
        matched_agent=matched_agent,
        agent_category=agent_category,
        verified_identity=verified_identity,
        tenant_context=None,
        requested_markdown=accept_result.prefers_markdown,
        path=path,
        method=method.upper(),
        headers={k.lower(): v for k, v in headers.items()},
        trace=[
            TraceEntry(
                layer="Layer0:Detection",
                action=f'Resolved tier="{tier}" via signals=[{", ".join(all_signals)}]. {reason}',
                duration_ms=duration_ms,
            )
        ],
    )

    return context
