"""
Central type definitions for the agentfriendly Python SDK.

These types mirror the TypeScript types in @agentfriendly/core/src/types/
to ensure behavioral consistency between the TS and Python SDKs.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC
from typing import Any, Literal

# ---------------------------------------------------------------------------
# Trust Tier
# ---------------------------------------------------------------------------

TrustTier = Literal["human", "suspected-agent", "known-agent", "verified-agent"]
"""
The central classification assigned to every incoming request.

Tier ordering (ascending trust/access):
  human < suspected-agent < known-agent < verified-agent
"""

DetectionSignal = Literal[
    "accept-header",
    "ua-database",
    "header-heuristics",
    "request-pattern",
    "rfc9421-signature",
    "clawdentity-ait",
]
"""Signal source(s) that contributed to the trust tier decision."""

TIER_ORDER: dict[TrustTier, int] = {
    "human": 0,
    "suspected-agent": 1,
    "known-agent": 2,
    "verified-agent": 3,
}


def meets_minimum_tier(actual: TrustTier, required: TrustTier) -> bool:
    """Check whether actual tier satisfies the required minimum tier."""
    return TIER_ORDER[actual] >= TIER_ORDER[required]


# ---------------------------------------------------------------------------
# Agent Entry (mirroring @agentfriendly/ua-database AgentEntry)
# ---------------------------------------------------------------------------

AgentCategory = Literal[
    "training-crawler", "search-bot", "interactive-agent", "browser-agent"
]
MatchType = Literal["exact", "prefix", "regex"]


@dataclass(frozen=True)
class AgentEntry:
    """A known AI agent in the UA database."""

    pattern: str
    match_type: MatchType
    agent_name: str
    operator: str
    operator_url: str | None
    category: AgentCategory
    description: str
    verification_support: bool
    first_seen: str
    sources: tuple[str, ...]


@dataclass(frozen=True)
class UaMatch:
    """Result of matching a User-Agent string against the database."""

    entry: AgentEntry
    confidence: Literal["high", "medium"]


# ---------------------------------------------------------------------------
# Verified Identity & Tenant Context
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class VerifiedIdentity:
    """Verified identity of an agent (RFC 9421 or Clawdentity)."""

    method: Literal["rfc9421", "clawdentity"]
    operator_domain: str
    agent_id: str
    scopes: tuple[str, ...]
    ait_claims: dict[str, Any] | None = None


@dataclass(frozen=True)
class TenantContext:
    """Multi-tenant agent session context (RFC 8693 delegation token)."""

    tenant_id: str
    user_id: str
    session_id: str
    granted_scopes: tuple[str, ...]
    expires_at: str


# ---------------------------------------------------------------------------
# Trace Entry
# ---------------------------------------------------------------------------


@dataclass
class TraceEntry:
    """A single trace entry from one layer of the processing pipeline."""

    layer: str
    action: str
    duration_ms: float


# ---------------------------------------------------------------------------
# AgentContext
# ---------------------------------------------------------------------------


@dataclass
class AgentContext:
    """
    Central object threaded through every layer of the middleware pipeline.
    Created fresh for each request by Layer 0 (detection).
    """

    request_id: str
    received_at: str
    tier: TrustTier
    signals: list[DetectionSignal]
    is_agent: bool
    user_agent: str
    matched_agent: AgentEntry | None
    agent_category: AgentCategory | None
    verified_identity: VerifiedIdentity | None
    tenant_context: TenantContext | None
    requested_markdown: bool
    path: str
    method: str
    headers: dict[str, str]
    trace: list[TraceEntry] = field(default_factory=list)

    @property
    def tier_reason(self) -> str:
        """Human-readable reason for the tier decision."""
        signals_str = ", ".join(self.signals) if self.signals else "none"
        return f"Resolved tier={self.tier!r} via signals=[{signals_str}]"

    @classmethod
    def for_request(
        cls,
        *,
        method: str,
        path: str,
        headers: dict[str, str],
    ) -> AgentContext:
        """Create a minimal human-classified AgentContext for a request."""
        return cls(
            request_id=str(uuid.uuid4()),
            received_at=_now_iso(),
            tier="human",
            signals=[],
            is_agent=False,
            user_agent=headers.get("user-agent", ""),
            matched_agent=None,
            agent_category=None,
            verified_identity=None,
            tenant_context=None,
            requested_markdown=False,
            path=path,
            method=method.upper(),
            headers={k.lower(): v for k, v in headers.items()},
        )


def _now_iso() -> str:
    """Return the current UTC time as an ISO 8601 string."""
    from datetime import datetime

    return datetime.now(UTC).isoformat()
