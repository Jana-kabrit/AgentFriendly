"""
Layer 1 — Discovery File Generators

Generates llms.txt, agent.json, webagents.md, and agent-tools.json.
Mirrors packages/core/src/discovery/generators.ts
"""

from __future__ import annotations

import json
from datetime import UTC, datetime

from ..config import AgentFriendlyConfig


def generate_llms_txt(config: AgentFriendlyConfig, site_domain: str = "localhost") -> str:
    """Generate /llms.txt content."""
    llms_cfg = config.discovery.llms_txt
    if llms_cfg is False:
        return ""

    if isinstance(llms_cfg, bool):
        from ..config import LlmsTxtConfig
        llms_cfg = LlmsTxtConfig()

    title = llms_cfg.title or site_domain
    description = llms_cfg.description or f"{site_domain} — an agent-friendly web application."

    lines = [
        f"# {title}",
        "",
        f"> {description}",
        "",
        "## Agent Discovery",
        "",
        f"- [Agent Manifest](https://{site_domain}/.well-known/agent.json): AHP manifest",
        f"- [Tool Definitions](https://{site_domain}/.well-known/agent-tools.json): JSON Schema tool definitions",
        f"- [In-Browser Tools](https://{site_domain}/webagents.md): JavaScript tool manifest",
        "",
    ]

    for entry in llms_cfg.manual_entries:
        url = entry.get("url", "")
        desc = entry.get("description", "")
        if not url.startswith("http"):
            url = f"https://{site_domain}{url}"
        lines.append(f"- [{desc}]({url}): {desc}")

    return "\n".join(lines)


def generate_agent_json(config: AgentFriendlyConfig, site_domain: str = "localhost") -> str:
    """Generate /.well-known/agent.json content."""
    llms_cfg = config.discovery.llms_txt
    if isinstance(llms_cfg, bool):
        site_name = site_domain
        site_description = f"{site_domain} — an agent-friendly web application."
    else:
        site_name = (llms_cfg.title or site_domain) if llms_cfg else site_domain
        site_description = (llms_cfg.description or f"{site_domain} agent-friendly app") if llms_cfg else ""

    modes = ["MODE1"]
    endpoints: dict[str, str] = {
        "content": f"https://{site_domain}/llms.txt",
        "tools": f"https://{site_domain}/.well-known/agent-tools.json",
    }

    if config.discovery.converseEndpoint if hasattr(config.discovery, 'converseEndpoint') else False:
        modes.append("MODE2")
        endpoints["converse"] = f"https://{site_domain}{config.tools.base_path}/converse"

    signals = config.content.signals
    manifest = {
        "ahp": "0.1",
        "modes": modes,
        "name": site_name,
        "description": site_description,
        "endpoints": endpoints,
        "content_signals": {
            "ai_train": signals.ai_train,
            "ai_input": signals.ai_input,
            "search": signals.search,
        },
    }

    return json.dumps(manifest, indent=2)


def generate_webagents_md(config: AgentFriendlyConfig) -> str:
    """Generate /webagents.md content."""
    return "# Agent Tools\n\nNo tools are currently registered.\n"


def generate_agent_tools_json(config: AgentFriendlyConfig, site_domain: str = "localhost") -> str:
    """Generate /.well-known/agent-tools.json content."""
    manifest = {
        "$schema": "https://agentfriendly.dev/schemas/agent-tools.json",
        "version": "1.0.0",
        "generatedAt": datetime.now(UTC).isoformat(),
        "site": f"https://{site_domain}",
        "tools": {},
    }
    return json.dumps(manifest, indent=2)
