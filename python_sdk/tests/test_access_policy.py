"""Tests for Layer 4 — Access Control Policy Engine"""

from agentfriendly.access.policy_engine import evaluate_policy, generate_robots_txt_ai_section
from agentfriendly.config import AccessConfig
from agentfriendly.types import AgentContext


def make_agent_context(
    tier="known-agent",
    path="/products",
    category="search-bot",
    operator="OpenAI",
) -> AgentContext:
    return AgentContext(
        request_id="test-req",
        received_at="2026-01-01T00:00:00+00:00",
        tier=tier,
        signals=["ua-database"],
        is_agent=True,
        user_agent="GPTBot/1.0",
        matched_agent=None,
        agent_category=category,
        verified_identity=None,
        tenant_context=None,
        requested_markdown=True,
        path=path,
        method="GET",
        headers={"user-agent": "GPTBot/1.0"},
    )


class TestEvaluatePolicy:
    def test_no_rules_allows_all(self):
        ctx = make_agent_context()
        result = evaluate_policy(ctx, AccessConfig())
        assert result.decision == "allow"

    def test_deny_pattern_blocks_path(self):
        ctx = make_agent_context(path="/admin/settings")
        result = evaluate_policy(ctx, AccessConfig(deny=["/admin/**"]))
        assert result.decision == "deny"
        assert result.status_code == 403

    def test_allow_overrides_deny(self):
        ctx = make_agent_context(path="/admin/public")
        result = evaluate_policy(
            ctx,
            AccessConfig(deny=["/admin/**"], allow=["/admin/public"]),
        )
        assert result.decision == "allow"

    def test_human_request_always_allowed(self):
        ctx = AgentContext(
            request_id="test",
            received_at="2026-01-01T00:00:00+00:00",
            tier="human",
            signals=[],
            is_agent=False,
            user_agent="Mozilla/5.0",
            matched_agent=None,
            agent_category=None,
            verified_identity=None,
            tenant_context=None,
            requested_markdown=False,
            path="/admin",
            method="GET",
            headers={},
        )
        result = evaluate_policy(ctx, AccessConfig(deny=["/admin/**"]))
        assert result.decision == "allow"


class TestGenerateRobotsTxt:
    def test_deny_all_generates_disallow(self):
        config = AccessConfig(agent_types={"training-crawler": "deny-all"})
        txt = generate_robots_txt_ai_section(config)
        assert "Disallow: /" in txt
        assert "GPTBot" in txt

    def test_allow_all_generates_allow(self):
        config = AccessConfig(agent_types={"search-bot": "allow-all"})
        txt = generate_robots_txt_ai_section(config)
        assert "Allow: /" in txt
