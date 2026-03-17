"""
FastAPI / Starlette Adapter

Add as ASGI middleware:

    from agentfriendly.adapters.fastapi import AgentFriendlyMiddleware as AFMiddleware
    from agentfriendly import AgentFriendlyConfig

    app.add_middleware(
        AFMiddleware,
        config=AgentFriendlyConfig(
            detection=DetectionConfig(proactive_markdown="known"),
        ),
    )

Access context in route handlers:

    from agentfriendly import get_agent_context

    @app.get("/docs")
    async def docs(request: Request):
        ctx = get_agent_context()
        return {"is_agent": ctx.is_agent if ctx else False}
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from ..config import AgentFriendlyConfig
from ..content.html_to_markdown import html_to_markdown
from ..middleware import AgentFriendlyMiddleware as CoreMiddleware


class AgentFriendlyMiddleware(BaseHTTPMiddleware):
    """
    Starlette/FastAPI ASGI middleware.
    Compatible with FastAPI, Starlette, and any ASGI framework.
    """

    def __init__(self, app: object, config: AgentFriendlyConfig | None = None) -> None:
        super().__init__(app)  # type: ignore[arg-type]
        self._sdk = CoreMiddleware(config)

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        # Build header dict (lowercased)
        headers = {k.lower(): v for k, v in request.headers.items()}
        path = request.url.path
        url = str(request.url)

        result = await self._sdk.process(
            method=request.method,
            path=path,
            headers=headers,
            url=url,
        )

        # Attach context to request state for downstream access
        request.state.agent_context = result.context

        # Serve early responses directly
        if result.early_response:
            er = result.early_response
            return Response(
                content=er.body,
                status_code=er.status,
                headers=er.headers,
                media_type=er.content_type,
            )

        # Let the route handler produce a response
        response = await call_next(request)

        # Inject agent headers
        for key, value in result.content_instructions.agent_headers.items():
            response.headers[key] = value

        # Convert HTML→Markdown for agent requests
        if result.content_instructions.convert_to_markdown:
            content_type = response.headers.get("content-type", "")
            if "text/html" in content_type:
                body_bytes = b""
                async for chunk in response.body_iterator:  # type: ignore[attr-defined]
                    body_bytes += chunk if isinstance(chunk, bytes) else chunk.encode()
                html_body = body_bytes.decode("utf-8", errors="replace")

                md_result = html_to_markdown(
                    html_body,
                    url,
                    result.content_instructions.additional_strip_selectors,
                )

                new_headers = dict(response.headers)
                new_headers["content-type"] = "text/markdown; charset=utf-8"
                new_headers["x-markdown-tokens"] = str(md_result.estimated_tokens)
                new_headers.pop("content-length", None)

                return Response(
                    content=md_result.markdown.encode("utf-8"),
                    status_code=response.status_code,
                    headers=new_headers,
                    media_type="text/markdown",
                )

        return response
