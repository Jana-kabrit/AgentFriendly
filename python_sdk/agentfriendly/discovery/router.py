"""
Layer 1 — Discovery Router

Serves pre-generated discovery files for agent requests.
Mirrors packages/core/src/discovery/router.ts
"""

from __future__ import annotations

import re

from ..config import AgentFriendlyConfig
from ..middleware import EarlyResponse
from .generators import (
    generate_agent_json,
    generate_agent_tools_json,
    generate_llms_txt,
    generate_webagents_md,
)

DISCOVERY_PATHS = {
    "/llms.txt",
    "/.well-known/agent.json",
    "/webagents.md",
    "/.well-known/agent-tools.json",
}


def serve_discovery_file(path: str, config: AgentFriendlyConfig) -> EarlyResponse | None:
    """Serve a discovery file response. Returns None if not a discovery path."""
    if path not in DISCOVERY_PATHS and not re.match(
        r"^/\.well-known/agent-tools/v\d+\.json$", path
    ):
        return None

    if path == "/llms.txt":
        return EarlyResponse(
            status=200,
            headers={
                "Content-Type": "text/markdown; charset=utf-8",
                "Cache-Control": "public, max-age=3600",
                "X-Robots-Tag": "noindex",
            },
            body=generate_llms_txt(config),
            content_type="text/markdown",
        )

    if path == "/.well-known/agent.json":
        return EarlyResponse(
            status=200,
            headers={
                "Content-Type": "application/json; charset=utf-8",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=3600",
            },
            body=generate_agent_json(config),
            content_type="application/json",
        )

    if path == "/webagents.md":
        return EarlyResponse(
            status=200,
            headers={
                "Content-Type": "text/markdown; charset=utf-8",
                "Cache-Control": "public, max-age=3600",
            },
            body=generate_webagents_md(config),
            content_type="text/markdown",
        )

    if path == "/.well-known/agent-tools.json":
        return EarlyResponse(
            status=200,
            headers={
                "Content-Type": "application/json; charset=utf-8",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=300",
            },
            body=generate_agent_tools_json(config),
            content_type="application/json",
        )

    import json

    return EarlyResponse(
        status=404,
        headers={"Content-Type": "application/json"},
        body=json.dumps({"error": "Discovery file not found", "path": path}),
        content_type="application/json",
    )
