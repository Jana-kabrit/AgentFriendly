"""Tests for Layer 0 — Header Heuristics Signal"""

from agentfriendly.detection.signal_header_heuristics import run_header_heuristics


def browser_headers() -> dict:
    return {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "cookie": "session=abc123",
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "navigate",
        "referer": "https://example.com",
    }


def minimal_agent_headers() -> dict:
    return {
        "accept": "*/*",
        "user-agent": "GPTBot/1.0",
    }


class TestRunHeaderHeuristics:
    def test_full_browser_headers_not_suspected(self):
        r = run_header_heuristics(browser_headers())
        assert r.is_suspected is False

    def test_minimal_agent_headers_suspected(self):
        r = run_header_heuristics(minimal_agent_headers())
        assert r.is_suspected is True
        assert "header-heuristics" in r.signals

    def test_custom_agent_header_fires(self):
        headers = minimal_agent_headers()
        headers["x-agent-id"] = "agent-007"
        r = run_header_heuristics(headers)
        assert r.is_suspected is True

    def test_score_increases_with_missing_signals(self):
        r_full = run_header_heuristics(browser_headers())
        r_minimal = run_header_heuristics(minimal_agent_headers())
        assert r_minimal.total_score > r_full.total_score
