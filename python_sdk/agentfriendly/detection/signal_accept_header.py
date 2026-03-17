"""
SIGNAL 1: Accept Header Analysis

Mirrors packages/core/src/detection/signal-accept-header.ts
"""

from __future__ import annotations

import contextlib
from dataclasses import dataclass


@dataclass(frozen=True)
class AcceptHeaderResult:
    prefers_markdown: bool
    prefers_agent_json: bool
    has_agent_signal: bool
    signals: tuple[str, ...]


def parse_accept_header(accept_header: str) -> list[tuple[str, float]]:
    """
    Parse an Accept header into a list of (mime_type, quality) tuples,
    sorted by quality descending.
    """
    entries: list[tuple[str, float]] = []
    for part in accept_header.split(","):
        segments = part.strip().split(";")
        mime_type = segments[0].strip().lower()
        quality = 1.0
        for seg in segments[1:]:
            seg = seg.strip()
            if seg.lower().startswith("q="):
                with contextlib.suppress(ValueError):
                    quality = float(seg[2:])
        if mime_type:
            entries.append((mime_type, quality))

    return sorted(entries, key=lambda e: e[1], reverse=True)


def get_quality_for(entries: list[tuple[str, float]], mime_type: str) -> float:
    """Get quality factor for a MIME type, considering type/* wildcards."""
    for entry_mime, quality in entries:
        if entry_mime == mime_type:
            return quality

    # Check type/* wildcard
    major = mime_type.split("/")[0]
    for entry_mime, quality in entries:
        if entry_mime == f"{major}/*":
            return quality

    # Check */*
    for entry_mime, quality in entries:
        if entry_mime == "*/*":
            return quality

    return 0.0


def analyze_accept_header(accept_header: str | None) -> AcceptHeaderResult:
    """
    Analyze the Accept header and return detected agent signals.

    Key difference from get_quality_for: `prefers_agent_json` only fires
    when `application/agent+json` is explicitly listed — not matched via wildcard.
    """
    if not accept_header:
        return AcceptHeaderResult(
            prefers_markdown=False,
            prefers_agent_json=False,
            has_agent_signal=False,
            signals=(),
        )

    entries = parse_accept_header(accept_header)

    markdown_q = get_quality_for(entries, "text/markdown")
    x_markdown_q = get_quality_for(entries, "text/x-markdown")
    html_q = get_quality_for(entries, "text/html")

    effective_markdown_q = max(markdown_q, x_markdown_q)
    prefers_markdown = effective_markdown_q > 0 and effective_markdown_q >= html_q

    # Only explicit listing — no wildcard fallback (same as TS SDK)
    prefers_agent_json = any(
        mime == "application/agent+json" for mime, _ in entries
    )

    has_agent_signal = prefers_markdown or prefers_agent_json
    signals = ("accept-header",) if has_agent_signal else ()

    return AcceptHeaderResult(
        prefers_markdown=prefers_markdown,
        prefers_agent_json=prefers_agent_json,
        has_agent_signal=has_agent_signal,
        signals=signals,
    )
