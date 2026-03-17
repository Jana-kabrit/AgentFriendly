"""
Layer 2 — Content Negotiator

Decides whether to serve markdown and builds response headers.
Mirrors packages/core/src/content/negotiator.ts
"""

from __future__ import annotations

import fnmatch

from ..config import ContentConfig, ProactiveMarkdown
from ..types import AgentContext

# Patterns always excluded from markdown conversion
ALWAYS_EXCLUDE_PATTERNS = ["**/*.json", "**/api/**"]


def build_content_signal_header(config: ContentConfig) -> str:
    """Build the content-signal HTTP response header value."""
    signals = config.signals
    parts = [
        f"ai-train={'yes' if signals.ai_train else 'no'}",
        f"ai-input={'yes' if signals.ai_input else 'no'}",
        f"search={'yes' if signals.search else 'no'}",
    ]
    return ", ".join(parts)


def should_serve_markdown(
    context: AgentContext,
    config: ContentConfig,
    proactive_markdown: ProactiveMarkdown = "known",
) -> bool:
    """
    Determine whether to serve markdown for the given agent context and config.

    Decision logic (mirrors ADR-008):
    - "known": serve to known-agent and verified-agent tiers
    - "suspected": also serve to suspected-agent tier
    - "verified": only serve to verified-agent
    - False: only serve when requestedMarkdown is True (explicit Accept header)
    """
    if not context.is_agent:
        return False
    if not config.markdown:
        return False
    if context.requested_markdown:
        return True

    if not isinstance(proactive_markdown, str):
        return False
    tier = context.tier
    tiers_by_level: dict[str, tuple[str, ...]] = {
        "verified": ("verified-agent",),
        "known": ("known-agent", "verified-agent"),
        "suspected": ("suspected-agent", "known-agent", "verified-agent"),
    }
    return tier in tiers_by_level.get(proactive_markdown, ())


def is_excluded_from_markdown(path: str, user_excluded: list[str] | None = None) -> bool:
    """Check whether a path should be excluded from markdown conversion."""
    all_patterns = ALWAYS_EXCLUDE_PATTERNS + (user_excluded or [])
    return any(fnmatch.fnmatch(path, pattern) for pattern in all_patterns)


def build_passthrough_headers(
    context: AgentContext,
    config: ContentConfig,
    debug: bool = False,
) -> dict[str, str]:
    """Build headers to inject into agent responses."""
    headers: dict[str, str] = {}

    if context.is_agent:
        headers["content-signal"] = build_content_signal_header(config)

    if debug:
        headers["x-agentfriendly-tier"] = context.tier
        headers["x-agentfriendly-request-id"] = context.request_id
        headers["x-agentfriendly-signals"] = ",".join(context.signals)
        if context.matched_agent:
            headers["x-agentfriendly-agent-name"] = context.matched_agent.agent_name
            headers["x-agentfriendly-agent-operator"] = context.matched_agent.operator

    return headers
