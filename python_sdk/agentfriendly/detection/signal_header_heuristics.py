"""
SIGNAL 3: HTTP Header Heuristics

Mirrors packages/core/src/detection/signal-header-heuristics.ts
"""

from __future__ import annotations

from dataclasses import dataclass

SUSPECTED_THRESHOLD = 3

BROWSER_ACCEPT_PATTERNS = [
    "text/html,application/xhtml+xml,application/xml",
    "text/html, application/xhtml+xml, application/xml",
]

AGENT_CUSTOM_HEADERS = {
    "x-agent-id",
    "x-agent-name",
    "x-agent-version",
    "x-model-context",
    "x-mcp-session",
}


@dataclass(frozen=True)
class HeuristicScore:
    name: str
    fired: bool
    weight: int
    reason: str


@dataclass(frozen=True)
class HeaderHeuristicsResult:
    is_suspected: bool
    total_score: int
    scores: tuple[HeuristicScore, ...]
    signals: tuple[str, ...]


def run_header_heuristics(headers: dict[str, str]) -> HeaderHeuristicsResult:
    """
    Analyze HTTP request headers for agent traffic patterns.
    Returns a HeaderHeuristicsResult with a score and whether the request
    is suspected to be from an agent.
    """
    scores: list[HeuristicScore] = []

    # Heuristic 1: Missing Accept-Language (weight: 2)
    has_accept_language = "accept-language" in headers
    scores.append(
        HeuristicScore(
            name="missing-accept-language",
            fired=not has_accept_language,
            weight=2,
            reason="Real browsers always send Accept-Language",
        )
    )

    # Heuristic 2: Missing Cookie (weight: 1)
    has_cookie = "cookie" in headers
    scores.append(
        HeuristicScore(
            name="no-cookie",
            fired=not has_cookie,
            weight=1,
            reason="Missing Cookie header",
        )
    )

    # Heuristic 3: Minimal or wildcard-only Accept (weight: 2)
    accept_header = headers.get("accept", "")
    is_browser_accept = any(p in accept_header for p in BROWSER_ACCEPT_PATTERNS)
    is_wildcard_only = accept_header in ("*/*", "")
    is_minimal_accept = (
        not is_browser_accept
        and not is_wildcard_only
        and accept_header.count(",") < 2
    )
    scores.append(
        HeuristicScore(
            name="minimal-accept-header",
            fired=is_wildcard_only or is_minimal_accept,
            weight=2,
            reason=f"Accept header is atypical for browsers: {accept_header[:60]}",
        )
    )

    # Heuristic 4: Non-browser User-Agent structure (weight: 1)
    ua = headers.get("user-agent", "")
    looks_like_browser = ua.startswith("Mozilla/5.0") and "AppleWebKit" in ua
    scores.append(
        HeuristicScore(
            name="non-browser-ua-structure",
            fired=bool(ua) and not looks_like_browser,
            weight=1,
            reason="User-Agent does not match standard browser structure",
        )
    )

    # Heuristic 5: Missing Sec-Fetch-* headers (weight: 2)
    has_sec_fetch = "sec-fetch-site" in headers or "sec-fetch-mode" in headers
    scores.append(
        HeuristicScore(
            name="no-sec-fetch-headers",
            fired=not has_sec_fetch,
            weight=2,
            reason="Browsers send Sec-Fetch-* headers; programmatic clients do not",
        )
    )

    # Heuristic 6: Missing Referer (weight: 1)
    has_referer = "referer" in headers
    scores.append(
        HeuristicScore(
            name="no-referer",
            fired=not has_referer,
            weight=1,
            reason="Missing Referer header",
        )
    )

    # Heuristic 7: Agent custom headers present (weight: 3)
    found_agent_header = next(
        (h for h in AGENT_CUSTOM_HEADERS if h in headers), None
    )
    scores.append(
        HeuristicScore(
            name="agent-custom-header",
            fired=found_agent_header is not None,
            weight=3,
            reason=f"Custom agent header detected: {found_agent_header or 'unknown'}",
        )
    )

    total_score = sum(s.weight for s in scores if s.fired)
    is_suspected = total_score >= SUSPECTED_THRESHOLD
    signals = ("header-heuristics",) if is_suspected else ()

    return HeaderHeuristicsResult(
        is_suspected=is_suspected,
        total_score=total_score,
        scores=tuple(scores),
        signals=signals,
    )
