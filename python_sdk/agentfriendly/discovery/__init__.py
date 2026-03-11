"""
Layer 1 — Discovery File Generators and Router

Mirrors packages/core/src/discovery/ in the TypeScript SDK.
"""

from .generators import (
    generate_llms_txt,
    generate_agent_json,
    generate_webagents_md,
    generate_agent_tools_json,
)
from .router import serve_discovery_file

__all__ = [
    "generate_llms_txt",
    "generate_agent_json",
    "generate_webagents_md",
    "generate_agent_tools_json",
    "serve_discovery_file",
]
