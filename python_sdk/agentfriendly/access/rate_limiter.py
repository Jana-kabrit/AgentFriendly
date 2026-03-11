"""Layer 4 — In-Memory Rate Limiter"""

from __future__ import annotations

import time
from collections import defaultdict

from ..types import AgentContext


class InMemoryRateLimiter:
    """
    Simple sliding window rate limiter.
    Thread-safe for single-process deployments.
    """

    def __init__(self, max_requests: int, window_seconds: int = 60) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._windows: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str) -> bool:
        """Returns True if the request is within the limit, False if rate-limited."""
        now = time.monotonic()
        window_start = now - self.window_seconds
        timestamps = self._windows[key]

        # Prune old timestamps
        self._windows[key] = [t for t in timestamps if t > window_start]

        if len(self._windows[key]) >= self.max_requests:
            return False

        self._windows[key].append(now)
        return True

    def get_count(self, key: str) -> int:
        now = time.monotonic()
        window_start = now - self.window_seconds
        return sum(1 for t in self._windows[key] if t > window_start)

    def clear(self) -> None:
        self._windows.clear()


def get_rate_limit_key(
    context: AgentContext,
    key_by: str = "identity",
) -> str:
    """Derive the rate limit key from an agent context."""
    if key_by == "ip":
        return (
            context.headers.get("x-forwarded-for", "").split(",")[0].strip()
            or context.headers.get("x-real-ip", "unknown-ip")
        )
    if key_by == "ua":
        return context.user_agent or "no-ua"
    # Default: "identity"
    if context.verified_identity:
        return context.verified_identity.agent_id
    if context.matched_agent:
        return context.matched_agent.agent_name
    return (
        context.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or "unknown"
    )
