"""
Layer 2 — Content negotiation and HTML→Markdown conversion.
Mirrors packages/core/src/content/ in the TypeScript SDK.
"""

from .negotiator import (
    build_content_signal_header,
    build_passthrough_headers,
    is_excluded_from_markdown,
    should_serve_markdown,
)
from .html_to_markdown import html_to_markdown, estimate_token_count

__all__ = [
    "build_content_signal_header",
    "build_passthrough_headers",
    "is_excluded_from_markdown",
    "should_serve_markdown",
    "html_to_markdown",
    "estimate_token_count",
]
