"""Tests for Layer 2 — Content Negotiation"""

from agentfriendly.config import ContentConfig
from agentfriendly.content.negotiator import (
    build_content_signal_header,
    is_excluded_from_markdown,
    should_serve_markdown,
)
from agentfriendly.types import AgentContext


def make_context(tier="known-agent", requested_markdown=False) -> AgentContext:
    return AgentContext(
        request_id="test",
        received_at="2026-01-01T00:00:00+00:00",
        tier=tier,
        signals=["ua-database"],
        is_agent=tier != "human",
        user_agent="GPTBot/1.0",
        matched_agent=None,
        agent_category=None,
        verified_identity=None,
        tenant_context=None,
        requested_markdown=requested_markdown,
        path="/docs",
        method="GET",
        headers={},
    )


class TestShouldServeMarkdown:
    def test_human_never_gets_markdown(self):
        ctx = make_context("human")
        assert should_serve_markdown(ctx, ContentConfig(markdown=True)) is False

    def test_known_agent_gets_markdown(self):
        ctx = make_context("known-agent")
        assert should_serve_markdown(ctx, ContentConfig(markdown=True), "known") is True

    def test_suspected_agent_with_known_threshold(self):
        ctx = make_context("suspected-agent")
        assert should_serve_markdown(ctx, ContentConfig(markdown=True), "known") is False

    def test_suspected_agent_with_suspected_threshold(self):
        ctx = make_context("suspected-agent")
        assert should_serve_markdown(ctx, ContentConfig(markdown=True), "suspected") is True

    def test_explicit_markdown_request_overrides(self):
        ctx = make_context("suspected-agent", requested_markdown=True)
        assert should_serve_markdown(ctx, ContentConfig(markdown=True), False) is True

    def test_markdown_disabled_in_config(self):
        ctx = make_context("known-agent")
        assert should_serve_markdown(ctx, ContentConfig(markdown=False)) is False


class TestIsExcludedFromMarkdown:
    def test_api_routes_excluded(self):
        assert is_excluded_from_markdown("/api/users") is True

    def test_regular_page_not_excluded(self):
        assert is_excluded_from_markdown("/about") is False

    def test_custom_exclusion(self):
        assert is_excluded_from_markdown("/docs/secret", ["/docs/secret"]) is True


class TestBuildContentSignalHeader:
    def test_default_signals(self):
        header = build_content_signal_header(ContentConfig())
        assert "ai-train=no" in header
        assert "ai-input=yes" in header
        assert "search=yes" in header
