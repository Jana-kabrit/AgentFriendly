"""
Flask Adapter

Usage:

    from flask import Flask
    from agentfriendly.adapters.flask import init_app
    from agentfriendly import AgentFriendlyConfig

    app = Flask(__name__)
    init_app(
        app,
        config=AgentFriendlyConfig(
            detection=DetectionConfig(proactive_markdown="known"),
        ),
    )

Access context in views:

    from agentfriendly import get_agent_context

    @app.route("/docs")
    def docs():
        ctx = get_agent_context()
        from flask import g
        ctx = g.agent_context  # also available on Flask's g object
"""

from __future__ import annotations

import asyncio

from flask import Flask, g, request as flask_request, Response, make_response  # type: ignore[import-untyped]

from ..config import AgentFriendlyConfig
from ..content.html_to_markdown import html_to_markdown
from ..middleware import AgentFriendlyMiddleware as CoreMiddleware


def init_app(app: Flask, config: AgentFriendlyConfig | None = None) -> None:
    """Register AgentFriendly before/after request hooks on a Flask app."""
    sdk = CoreMiddleware(config)

    @app.before_request
    def before_request() -> Response | None:  # type: ignore[return]
        headers = {k.lower(): v for k, v in flask_request.headers.items()}
        loop = asyncio.new_event_loop()
        try:
            result = loop.run_until_complete(
                sdk.process(
                    method=flask_request.method,
                    path=flask_request.path,
                    headers=headers,
                    url=flask_request.url,
                )
            )
        finally:
            loop.close()

        g.agent_result = result
        g.agent_context = result.context

        # Serve early responses before the route handler
        if result.early_response:
            er = result.early_response
            resp = make_response(er.body, er.status)
            resp.content_type = er.content_type
            for key, value in er.headers.items():
                resp.headers[key] = value
            return resp

        return None

    @app.after_request
    def after_request(response: Response) -> Response:
        result = getattr(g, "agent_result", None)
        if not result:
            return response

        # Inject agent headers
        for key, value in result.content_instructions.agent_headers.items():
            response.headers[key] = value

        # Convert HTML→Markdown for agent requests
        if result.content_instructions.convert_to_markdown:
            ct = response.content_type or ""
            if "text/html" in ct:
                body = response.get_data(as_text=True)
                md_result = html_to_markdown(
                    body,
                    flask_request.url,
                    result.content_instructions.additional_strip_selectors,
                )
                response.set_data(md_result.markdown)
                response.content_type = "text/markdown; charset=utf-8"
                response.headers["x-markdown-tokens"] = str(md_result.estimated_tokens)

        return response
