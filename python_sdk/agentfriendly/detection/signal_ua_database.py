"""
SIGNAL 2: User-Agent Database Lookup

Loads agents.json from the @agentfriendly/ua-database package (shared data file)
and matches incoming User-Agent strings against it.

The data file is read once at module import time and cached in memory.
This mirrors packages/core/src/detection/signal-ua-database.ts.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

from ..types import AgentEntry, AgentCategory, MatchType, UaMatch

# ---------------------------------------------------------------------------
# Load agents.json from the shared data directory
# ---------------------------------------------------------------------------

# The agents.json lives at packages/ua-database/data/agents.json.
# We locate it relative to this file's position in the repo.
_REPO_ROOT = Path(__file__).parent.parent.parent.parent
_AGENTS_JSON = _REPO_ROOT / "packages" / "ua-database" / "data" / "agents.json"


def _load_database() -> list[AgentEntry]:
    """Load the agents.json database and return a list of AgentEntry objects."""
    try:
        with open(_AGENTS_JSON, encoding="utf-8") as f:
            raw = json.load(f)
    except FileNotFoundError:
        # When installed as a PyPI package, agents.json is bundled in the wheel
        import importlib.resources as pkg

        data = pkg.files("agentfriendly").joinpath("data/agents.json").read_text(
            encoding="utf-8"
        )
        raw = json.loads(data)

    agents: list[AgentEntry] = []
    for entry in raw.get("agents", []):
        agents.append(
            AgentEntry(
                pattern=entry["pattern"],
                match_type=entry["matchType"],
                agent_name=entry["agentName"],
                operator=entry["operator"],
                operator_url=entry.get("operatorUrl"),
                category=entry["category"],
                description=entry["description"],
                verification_support=entry.get("verificationSupport", False),
                first_seen=entry.get("firstSeen", ""),
                sources=tuple(entry.get("sources", [])),
            )
        )
    return agents


# Build indexes at module load time (O(1) lookups)
UA_DATABASE: list[AgentEntry] = _load_database()

_EXACT_INDEX: dict[str, AgentEntry] = {
    e.pattern: e for e in UA_DATABASE if e.match_type == "exact"
}
_PREFIX_ENTRIES: list[AgentEntry] = [e for e in UA_DATABASE if e.match_type == "prefix"]
_REGEX_ENTRIES: list[tuple[re.Pattern[str], AgentEntry]] = [
    (re.compile(e.pattern, re.IGNORECASE), e)
    for e in UA_DATABASE
    if e.match_type == "regex"
]


@dataclass(frozen=True)
class UaDatabaseResult:
    matched: bool
    match: UaMatch | None
    signals: tuple[str, ...]


def check_ua_database(
    user_agent: str | None,
    custom_agents: list[str] | None = None,
) -> UaDatabaseResult:
    """
    Check the User-Agent string against the agent database.

    Returns a UaDatabaseResult indicating whether a match was found.
    """
    if not user_agent:
        return UaDatabaseResult(matched=False, match=None, signals=())

    # 1. Exact match
    if user_agent in _EXACT_INDEX:
        entry = _EXACT_INDEX[user_agent]
        return UaDatabaseResult(
            matched=True,
            match=UaMatch(entry=entry, confidence="high"),
            signals=("ua-database",),
        )

    # 2. Prefix match
    for entry in _PREFIX_ENTRIES:
        if user_agent.startswith(entry.pattern):
            return UaDatabaseResult(
                matched=True,
                match=UaMatch(entry=entry, confidence="high"),
                signals=("ua-database",),
            )

    # 3. Regex match
    for pattern, entry in _REGEX_ENTRIES:
        if pattern.search(user_agent):
            return UaDatabaseResult(
                matched=True,
                match=UaMatch(entry=entry, confidence="medium"),
                signals=("ua-database",),
            )

    # 4. Custom agents from config
    if custom_agents:
        for custom_pattern in custom_agents:
            if user_agent.startswith(custom_pattern) or user_agent == custom_pattern:
                synthetic = AgentEntry(
                    pattern=custom_pattern,
                    match_type="prefix",
                    agent_name=custom_pattern,
                    operator="Custom",
                    operator_url=None,
                    category="interactive-agent",
                    description="Custom agent from agentfriendly config",
                    verification_support=False,
                    first_seen="",
                    sources=(),
                )
                return UaDatabaseResult(
                    matched=True,
                    match=UaMatch(entry=synthetic, confidence="high"),
                    signals=("ua-database",),
                )

    return UaDatabaseResult(matched=False, match=None, signals=())
