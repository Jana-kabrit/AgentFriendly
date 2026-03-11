"""
Django Middleware Adapter

Add to MIDDLEWARE in settings.py:

    MIDDLEWARE = [
        "agentfriendly.adapters.django.AgentFriendlyMiddleware",
        # ... other middleware
    ]

Configure in settings.py:

    AGENTFRIENDLY = {
        "detection": {"proactive_markdown": "known"},
        "content": {"markdown": True},
    }

Access context in views:

    from agentfriendly import get_agent_context

    def my_view(request):
        ctx = get_agent_context()
        # or via request
        ctx = getattr(request, "agent_context", None)
"""

from __future__ import annotations

from django.http import HttpRequest, HttpResponse  # type: ignore[import-untyped]
from django.conf import settings  # type: ignore[import-untyped]

from ..config import AgentFriendlyConfig
from ..content.html_to_markdown import html_to_markdown
from ..middleware import AgentFriendlyMiddleware as CoreMiddleware


def _load_config_from_settings() -> AgentFriendlyConfig:
    """Load config from Django settings.AGENTFRIENDLY dict."""
    raw = getattr(settings, "AGENTFRIENDLY", {})
    if not isinstance(raw, dict):
        return AgentFriendlyConfig()
    return _dict_to_config(raw)


def _dict_to_config(raw: dict) -> AgentFriendlyConfig:
    """Convert a plain settings dict to AgentFriendlyConfig."""
    from ..config import (
        DetectionConfig, ContentConfig, AccessConfig, AnalyticsConfig,
        PrivacyConfig, ToolsConfig, MonetizationConfig, MultiTenancyConfig,
        DiscoveryConfig,
    )

    def section(name: str, cls):  # type: ignore[no-untyped-def]
        data = raw.get(name, {})
        if isinstance(data, dict):
            return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})
        return cls()

    return AgentFriendlyConfig(
        detection=section("detection", DetectionConfig),
        discovery=section("discovery", DiscoveryConfig),
        content=section("content", ContentConfig),
        analytics=section("analytics", AnalyticsConfig),
        access=section("access", AccessConfig),
        privacy=section("privacy", PrivacyConfig),
        tools=section("tools", ToolsConfig),
        monetization=section("monetization", MonetizationConfig),
        multi_tenancy=section("multi_tenancy", MultiTenancyConfig),
        debug=raw.get("debug", False),
    )


class AgentFriendlyMiddleware:
    """Django middleware class (get_response pattern)."""

    def __init__(self, get_response):  # type: ignore[no-untyped-def]
        self.get_response = get_response
        config = _load_config_from_settings()
        self._sdk = CoreMiddleware(config)

    def __call__(self, request: HttpRequest):  # type: ignore[no-untyped-def]
        import asyncio

        # Run the async SDK process in the sync Django context
        loop = asyncio.new_event_loop()
        try:
            result = loop.run_until_complete(
                self._sdk.process(
                    method=request.method,
                    path=request.path,
                    headers={k.lower(): v for k, v in request.META.items() if k.startswith("HTTP_")},
                    url=request.build_absolute_uri(),
                )
            )
        finally:
            loop.close()

        # Attach context to the request
        request.agent_context = result.context  # type: ignore[attr-defined]

        # Serve early responses
        if result.early_response:
            er = result.early_response
            response = HttpResponse(
                content=er.body,
                status=er.status,
                content_type=er.content_type,
            )
            for key, value in er.headers.items():
                response[key] = value
            return response

        # Let Django handle the request
        response: HttpResponse = self.get_response(request)

        # Inject agent headers
        for key, value in result.content_instructions.agent_headers.items():
            response[key] = value

        # Convert HTML→Markdown for agent requests
        if result.content_instructions.convert_to_markdown:
            ct = response.get("Content-Type", "")
            if "text/html" in ct:
                body = response.content.decode("utf-8", errors="replace")
                md_result = html_to_markdown(
                    body,
                    request.build_absolute_uri(),
                    result.content_instructions.additional_strip_selectors,
                )
                response.content = md_result.markdown.encode("utf-8")
                response["Content-Type"] = "text/markdown; charset=utf-8"
                response["x-markdown-tokens"] = str(md_result.estimated_tokens)
                del response["Content-Length"]

        return response
