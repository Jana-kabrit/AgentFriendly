"""
Layer 0 — Detection Pipeline

Runs all 4 detection signals and resolves a TrustTier for each request.
Mirrors packages/core/src/detection/ in the TypeScript SDK.
"""

from .pipeline import run_detection_pipeline
from .signal_accept_header import analyze_accept_header
from .signal_header_heuristics import run_header_heuristics
from .signal_ua_database import UA_DATABASE, check_ua_database

__all__ = [
    "run_detection_pipeline",
    "analyze_accept_header",
    "run_header_heuristics",
    "check_ua_database",
    "UA_DATABASE",
]
