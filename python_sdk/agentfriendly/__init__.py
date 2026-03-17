"""
agentfriendly — Python SDK

Make your Python web application agent-friendly.

Supports FastAPI, Django, Flask, and any ASGI/WSGI framework.

Quick start:
    pip install agentfriendly[fastapi]

FastAPI:
    from fastapi import FastAPI
    from agentfriendly.adapters.fastapi import AgentFriendlyMiddleware
    from agentfriendly import AgentFriendlyConfig

    app = FastAPI()
    app.add_middleware(AgentFriendlyMiddleware, config=AgentFriendlyConfig())
"""

from .config import (
    AccessConfig,
    AgentFriendlyConfig,
    AnalyticsConfig,
    ContentConfig,
    DetectionConfig,
    DiscoveryConfig,
    MonetizationConfig,
    MultiTenancyConfig,
    PrivacyConfig,
    ToolsConfig,
)
from .middleware import (
    AgentFriendlyMiddleware,
    ContentInstructions,
    EarlyResponse,
    OrchestratorResult,
    get_agent_context,
)
from .multitenancy import issue_delegation_token, revoke_session, validate_delegation_token
from .types import (
    TIER_ORDER,
    AgentContext,
    AgentEntry,
    DetectionSignal,
    TenantContext,
    TrustTier,
    VerifiedIdentity,
    meets_minimum_tier,
)

__all__ = [
    # Config
    "AgentFriendlyConfig",
    "DetectionConfig",
    "DiscoveryConfig",
    "ContentConfig",
    "AnalyticsConfig",
    "AccessConfig",
    "PrivacyConfig",
    "ToolsConfig",
    "MonetizationConfig",
    "MultiTenancyConfig",
    # Middleware
    "AgentFriendlyMiddleware",
    "get_agent_context",
    "OrchestratorResult",
    "EarlyResponse",
    "ContentInstructions",
    # Types
    "TrustTier",
    "DetectionSignal",
    "AgentContext",
    "AgentEntry",
    "VerifiedIdentity",
    "TenantContext",
    "TIER_ORDER",
    "meets_minimum_tier",
    # Multi-tenancy
    "issue_delegation_token",
    "validate_delegation_token",
    "revoke_session",
]
