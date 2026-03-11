"""
Layer 5 — PII Masker

Mirrors packages/core/src/privacy/masker.ts
"""

from __future__ import annotations

import copy
from typing import Any

from ..config import PrivacyConfig
from ..types import AgentContext
from .pii_patterns import BUILT_IN_PII_PATTERNS, PiiPattern


def mask_text_content(text: str, config: PrivacyConfig) -> str:
    """Mask all PII in a plaintext/markdown string."""
    if not config.enabled:
        return text

    patterns = list(BUILT_IN_PII_PATTERNS) + [
        PiiPattern(name=f"custom-{i}", pattern=p, placeholder="[REDACTED]")
        for i, p in enumerate(config.additional_patterns or [])
    ]

    masked = text
    for pii in patterns:
        masked = pii.pattern.sub(pii.placeholder, masked)
    return masked


def mask_json_fields(
    obj: dict[str, Any],
    pii_fields: list[str],
    context: AgentContext,
) -> dict[str, Any]:
    """
    Mask specific fields in a JSON-serializable dict before sending to agents.
    Supports dot notation for nested fields.
    """
    if not pii_fields:
        return obj

    # Determine which fields are revealed by tenant scopes
    granted_scopes = list(context.tenant_context.granted_scopes) if context.tenant_context else []
    unmasked_fields = {
        s.replace("reveal:", "") for s in granted_scopes if s.startswith("reveal:")
    }

    result = copy.deepcopy(obj)
    for field_path in pii_fields:
        if field_path in unmasked_fields:
            continue
        _mask_field_path(result, field_path.split("."))
    return result


def _mask_field_path(obj: Any, path_parts: list[str]) -> None:
    """Recursively mask a field at a dot-notation path."""
    if not path_parts or not isinstance(obj, dict):
        return

    head, *rest = path_parts
    if not head:
        return

    if not rest:
        if head in obj:
            obj[head] = "[REDACTED]"
        return

    child = obj.get(head)
    if isinstance(child, list):
        for item in child:
            _mask_field_path(item, rest)
    elif isinstance(child, dict):
        _mask_field_path(child, rest)
