"""
Core Middleware Orchestrator (Python)

Composes all 8 layers into a single async function that processes each request.
Mirrors packages/core/src/middleware.ts
"""

from __future__ import annotations

from contextvars import ContextVar
from dataclasses import dataclass

from .access.policy_engine import evaluate_policy
from .access.rate_limiter import InMemoryRateLimiter, get_rate_limit_key
from .config import AgentFriendlyConfig
from .content.negotiator import (
    build_content_signal_header,
    build_passthrough_headers,
    is_excluded_from_markdown,
    should_serve_markdown,
)
from .detection.pipeline import run_detection_pipeline
from .types import AgentContext

# ---------------------------------------------------------------------------
# Context variable for threading AgentContext through async call stacks
# ---------------------------------------------------------------------------

_agent_context_var: ContextVar[AgentContext | None] = ContextVar(
    "agentfriendly_context", default=None
)


def get_agent_context() -> AgentContext | None:
    """
    Get the AgentContext for the current async execution context.
    Returns None if called outside of a request handler.

    Example (FastAPI):
        from agentfriendly import get_agent_context

        @app.get("/docs")
        async def docs():
            ctx = get_agent_context()
            return {"is_agent": ctx.is_agent if ctx else False}
    """
    return _agent_context_var.get()


# ---------------------------------------------------------------------------
# Early Response
# ---------------------------------------------------------------------------


@dataclass
class EarlyResponse:
    """Signals that the middleware is serving a response directly."""
    status: int
    headers: dict[str, str]
    body: str
    content_type: str


@dataclass
class ContentInstructions:
    """Instructions for the content layer after the route handler runs."""
    convert_to_markdown: bool
    request_url: str
    additional_strip_selectors: list[str]
    agent_headers: dict[str, str]


@dataclass
class OrchestratorResult:
    context: AgentContext
    early_response: EarlyResponse | None
    content_instructions: ContentInstructions


def _no_content_conversion(url: str) -> ContentInstructions:
    return ContentInstructions(
        convert_to_markdown=False,
        request_url=url,
        additional_strip_selectors=[],
        agent_headers={},
    )


# ---------------------------------------------------------------------------
# Main Middleware Class
# ---------------------------------------------------------------------------


class AgentFriendlyMiddleware:
    """
    Core middleware orchestrator. Instantiate once at app startup,
    call process() on every request.
    """

    def __init__(self, config: AgentFriendlyConfig | None = None) -> None:
        self.config = config or AgentFriendlyConfig()
        self._rate_limiter: InMemoryRateLimiter | None = (
            InMemoryRateLimiter(
                self.config.access.rate_limit.max_requests,
                self.config.access.rate_limit.window_seconds,
            )
            if self.config.access.rate_limit
            else None
        )

    async def process(
        self,
        *,
        method: str,
        path: str,
        headers: dict[str, str],
        url: str = "",
    ) -> OrchestratorResult:
        """
        Process a request through all 8 layers.
        Returns an OrchestratorResult the framework adapter uses to respond.
        """
        cfg = self.config

        # ------------------------------------------------------------------
        # Layer 0: Detection
        # ------------------------------------------------------------------
        context = await run_detection_pipeline(
            method=method,
            path=path,
            headers=headers,
            config=cfg.detection,
        )

        # Thread context via ContextVar
        _agent_context_var.set(context)

        # ------------------------------------------------------------------
        # Layer 8 (pre-flight): Multi-Tenancy Token Validation
        # ------------------------------------------------------------------
        if cfg.multi_tenancy.enabled and cfg.multi_tenancy.token_secret:
            token_header = headers.get("x-agent-session") or (
                headers.get("authorization")
                if (headers.get("authorization", "")).lower().startswith(
                    ("bearer", "agentsession")
                )
                else None
            )
            if token_header:
                try:
                    from .multitenancy import validate_delegation_token

                    token_result = await validate_delegation_token(
                        token_header, cfg.multi_tenancy
                    )
                    if token_result.valid and token_result.tenant_context:
                        from dataclasses import replace

                        context = replace(
                            context, tenant_context=token_result.tenant_context
                        )
                        _agent_context_var.set(context)
                except ImportError:
                    pass

        # ------------------------------------------------------------------
        # Layer 1: Discovery File Serving
        # ------------------------------------------------------------------
        # Discovery files are served for all requestors (no tier restriction)
        discovery_paths = {
            "/llms.txt",
            "/.well-known/agent.json",
            "/webagents.md",
            "/.well-known/agent-tools.json",
        }
        if path in discovery_paths or path.startswith("/.well-known/agent-tools/"):
            from .discovery import serve_discovery_file

            response = serve_discovery_file(path, cfg)
            if response:
                return OrchestratorResult(
                    context=context,
                    early_response=response,
                    content_instructions=_no_content_conversion(url),
                )

        # ------------------------------------------------------------------
        # Non-agent: passthrough immediately
        # ------------------------------------------------------------------
        if not context.is_agent:
            return OrchestratorResult(
                context=context,
                early_response=None,
                content_instructions=_no_content_conversion(url),
            )

        # ------------------------------------------------------------------
        # Layer 4: Access Control
        # ------------------------------------------------------------------
        policy_result = evaluate_policy(context, cfg.access)

        if policy_result.decision == "deny":
            return OrchestratorResult(
                context=context,
                early_response=EarlyResponse(
                    status=403,
                    headers={"Content-Type": "text/markdown"},
                    body=f"# Access Denied\n\n{policy_result.reason}\n",
                    content_type="text/markdown",
                ),
                content_instructions=_no_content_conversion(url),
            )

        # Rate limiting
        rl_config = cfg.access.rate_limit
        if self._rate_limiter and rl_config:
            key = get_rate_limit_key(context, rl_config.key_by)
            if not self._rate_limiter.check(key):
                count = self._rate_limiter.get_count(key)
                return OrchestratorResult(
                    context=context,
                    early_response=EarlyResponse(
                        status=429,
                        headers={
                            "Content-Type": "text/markdown",
                            "Retry-After": "60",
                        },
                        body=(
                            f"# Rate Limit Exceeded\n\n"
                            f"Exceeded {rl_config.max_requests} requests per "
                            f"{rl_config.window_seconds}s. Count: {count}.\n"
                        ),
                        content_type="text/markdown",
                    ),
                    content_instructions=_no_content_conversion(url),
                )

        # ------------------------------------------------------------------
        # Layer 7: Monetization (x402)
        # ------------------------------------------------------------------
        if cfg.monetization.enabled:
            from .monetization import check_monetization

            mon_response = check_monetization(context, cfg.monetization, headers)
            if mon_response:
                return OrchestratorResult(
                    context=context,
                    early_response=mon_response,
                    content_instructions=_no_content_conversion(url),
                )

        # ------------------------------------------------------------------
        # Layer 2: Content Negotiation Instructions
        # ------------------------------------------------------------------
        agent_headers = build_passthrough_headers(context, cfg.content, cfg.debug)
        agent_headers["content-signal"] = build_content_signal_header(cfg.content)

        will_convert = should_serve_markdown(
            context, cfg.content, cfg.detection.proactive_markdown
        ) and not is_excluded_from_markdown(path, cfg.content.exclude_from_markdown)

        return OrchestratorResult(
            context=context,
            early_response=None,
            content_instructions=ContentInstructions(
                convert_to_markdown=will_convert,
                request_url=url,
                additional_strip_selectors=cfg.content.strip_selectors,
                agent_headers=agent_headers,
            ),
        )
