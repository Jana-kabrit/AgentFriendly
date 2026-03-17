"""Tests for Layer 0 — Accept Header Signal"""

from agentfriendly.detection.signal_accept_header import analyze_accept_header


class TestAnalyzeAcceptHeader:
    def test_none_header(self):
        r = analyze_accept_header(None)
        assert r.prefers_markdown is False
        assert r.prefers_agent_json is False
        assert r.has_agent_signal is False

    def test_browser_accept_header(self):
        r = analyze_accept_header(
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        )
        assert r.prefers_markdown is False
        assert r.has_agent_signal is False

    def test_markdown_prefer(self):
        r = analyze_accept_header("text/markdown, text/html;q=0.5")
        assert r.prefers_markdown is True
        assert r.has_agent_signal is True

    def test_text_x_markdown(self):
        r = analyze_accept_header("text/x-markdown")
        assert r.prefers_markdown is True

    def test_agent_json_explicit(self):
        r = analyze_accept_header("application/agent+json, application/json;q=0.5")
        assert r.prefers_agent_json is True
        assert r.has_agent_signal is True

    def test_wildcard_does_not_trigger_agent_json(self):
        r = analyze_accept_header("*/*")
        assert r.prefers_agent_json is False

    def test_equal_quality_html_vs_markdown(self):
        # Both equal quality — markdown signal fires because it's explicitly listed
        r = analyze_accept_header("text/markdown;q=1.0, text/html;q=1.0")
        assert r.prefers_markdown is True

    def test_lower_quality_markdown(self):
        r = analyze_accept_header("text/html;q=1.0, text/markdown;q=0.3")
        assert r.prefers_markdown is False
