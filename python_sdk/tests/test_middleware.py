"""Tests for the core middleware orchestrator"""

import pytest

from agentfriendly import AgentFriendlyConfig, AgentFriendlyMiddleware, DetectionConfig
from agentfriendly.config import AccessConfig


@pytest.mark.asyncio
class TestAgentFriendlyMiddleware:
    async def test_human_request_passthrough(self):
        sdk = AgentFriendlyMiddleware()
        result = await sdk.process(
            method="GET",
            path="/",
            headers={
                "accept": "text/html,application/xhtml+xml,*/*;q=0.8",
                "accept-language": "en-US,en;q=0.9",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36",
                "sec-fetch-site": "same-origin",
                "cookie": "session=abc",
            },
            url="https://example.com/",
        )
        assert result.context.tier == "human"
        assert result.context.is_agent is False
        assert result.early_response is None

    async def test_known_agent_detected(self):
        sdk = AgentFriendlyMiddleware()
        result = await sdk.process(
            method="GET",
            path="/docs",
            headers={"user-agent": "GPTBot/1.0", "accept": "text/markdown"},
            url="https://example.com/docs",
        )
        assert result.context.tier in ("known-agent", "verified-agent")
        assert result.context.is_agent is True

    async def test_discovery_file_served(self):
        sdk = AgentFriendlyMiddleware()
        result = await sdk.process(
            method="GET",
            path="/llms.txt",
            headers={"user-agent": "GPTBot/1.0"},
            url="https://example.com/llms.txt",
        )
        assert result.early_response is not None
        assert result.early_response.status == 200
        assert "text/markdown" in result.early_response.content_type

    async def test_access_deny_route(self):
        sdk = AgentFriendlyMiddleware(
            AgentFriendlyConfig(access=AccessConfig(deny=["/admin/**"]))
        )
        result = await sdk.process(
            method="GET",
            path="/admin/users",
            headers={"user-agent": "GPTBot/1.0", "accept": "text/markdown"},
            url="https://example.com/admin/users",
        )
        assert result.early_response is not None
        assert result.early_response.status == 403

    async def test_markdown_conversion_flag_for_agent(self):
        sdk = AgentFriendlyMiddleware(
            AgentFriendlyConfig(
                detection=DetectionConfig(proactive_markdown="known")
            )
        )
        result = await sdk.process(
            method="GET",
            path="/about",
            headers={"user-agent": "GPTBot/1.0"},
            url="https://example.com/about",
        )
        assert result.content_instructions.convert_to_markdown is True
