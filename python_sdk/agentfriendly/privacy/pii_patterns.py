"""
Layer 5 — Built-in PII Detection Patterns

Mirrors packages/core/src/privacy/pii-patterns.ts
"""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class PiiPattern:
    name: str
    pattern: re.Pattern[str]
    placeholder: str


BUILT_IN_PII_PATTERNS: tuple[PiiPattern, ...] = (
    PiiPattern(
        name="credit-card",
        pattern=re.compile(r"\b(?:\d[ -]?){13,19}\b"),
        placeholder="[CREDIT_CARD]",
    ),
    PiiPattern(
        name="ssn",
        pattern=re.compile(r"\b\d{3}-\d{2}-\d{4}\b|\b\d{9}\b"),
        placeholder="[SSN]",
    ),
    PiiPattern(
        name="email",
        pattern=re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"),
        placeholder="[EMAIL]",
    ),
    PiiPattern(
        name="phone",
        pattern=re.compile(
            r"(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}"
        ),
        placeholder="[PHONE]",
    ),
    PiiPattern(
        name="ipv4",
        pattern=re.compile(
            r"\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}"
            r"(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b"
        ),
        placeholder="[IP_ADDRESS]",
    ),
    PiiPattern(
        name="date-of-birth",
        pattern=re.compile(
            r"\b(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12][0-9]|3[01])\/(19|20)\d{2}\b"
            r"|\b(19|20)\d{2}-(?:0?[1-9]|1[0-2])-(?:0?[1-9]|[12][0-9]|3[01])\b"
        ),
        placeholder="[DATE_OF_BIRTH]",
    ),
    PiiPattern(
        name="zip-code",
        pattern=re.compile(r"\b\d{5}(?:-\d{4})?\b"),
        placeholder="[ZIP_CODE]",
    ),
)
