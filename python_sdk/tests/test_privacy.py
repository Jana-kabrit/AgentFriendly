"""Tests for Layer 5 — PII Masking"""

from agentfriendly.config import PrivacyConfig
from agentfriendly.privacy.masker import mask_json_fields, mask_text_content
from agentfriendly.types import AgentContext


def enabled_config() -> PrivacyConfig:
    return PrivacyConfig(enabled=True)


def base_context() -> AgentContext:
    return AgentContext(
        request_id="test",
        received_at="2026-01-01T00:00:00+00:00",
        tier="known-agent",
        signals=[],
        is_agent=True,
        user_agent="GPTBot/1.0",
        matched_agent=None,
        agent_category=None,
        verified_identity=None,
        tenant_context=None,
        requested_markdown=True,
        path="/",
        method="GET",
        headers={},
    )


class TestMaskTextContent:
    def test_email_masked(self):
        result = mask_text_content("Contact us at user@example.com today.", enabled_config())
        assert "user@example.com" not in result
        assert "[EMAIL]" in result

    def test_phone_masked(self):
        result = mask_text_content("Call 555-123-4567 for support.", enabled_config())
        assert "555-123-4567" not in result
        assert "[PHONE]" in result

    def test_ssn_masked(self):
        result = mask_text_content("SSN: 123-45-6789", enabled_config())
        assert "123-45-6789" not in result
        assert "[SSN]" in result

    def test_disabled_privacy_no_masking(self):
        cfg = PrivacyConfig(enabled=False)
        text = "Email: user@example.com"
        result = mask_text_content(text, cfg)
        assert result == text


class TestMaskJsonFields:
    def test_top_level_field_masked(self):
        obj = {"name": "Alice", "email": "alice@example.com", "role": "admin"}
        ctx = base_context()
        result = mask_json_fields(obj, ["email"], ctx)
        assert result["email"] == "[REDACTED]"
        assert result["name"] == "Alice"

    def test_nested_field_masked(self):
        obj = {"user": {"ssn": "123-45-6789", "name": "Bob"}}
        ctx = base_context()
        result = mask_json_fields(obj, ["user.ssn"], ctx)
        assert result["user"]["ssn"] == "[REDACTED]"
        assert result["user"]["name"] == "Bob"

    def test_granted_scope_reveals_field(self):
        from agentfriendly.types import TenantContext

        ctx = base_context()
        tc = TenantContext(
            tenant_id="t1",
            user_id="u1",
            session_id="s1",
            granted_scopes=("reveal:email",),
            expires_at="2026-12-31T00:00:00+00:00",
        )
        import dataclasses
        ctx = dataclasses.replace(ctx, tenant_context=tc)

        obj = {"email": "alice@example.com"}
        result = mask_json_fields(obj, ["email"], ctx)
        assert result["email"] == "alice@example.com"
