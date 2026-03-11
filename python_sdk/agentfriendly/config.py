"""
SDK configuration dataclasses for the agentfriendly Python SDK.
Mirrors AgentFriendlyConfig in @agentfriendly/core/src/types/config.ts.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

from .types import AgentCategory, TrustTier

# ---------------------------------------------------------------------------
# Layer 0: Detection
# ---------------------------------------------------------------------------

ProactiveMarkdown = Literal["known", "suspected", "verified"] | Literal[False]


@dataclass
class DetectionConfig:
    proactive_markdown: ProactiveMarkdown = "known"
    custom_agents: list[str] = field(default_factory=list)
    header_heuristics: bool = True
    request_pattern_analysis: bool = True
    agent_json_accept_header: bool = True


# ---------------------------------------------------------------------------
# Layer 1: Discovery
# ---------------------------------------------------------------------------


@dataclass
class LlmsTxtConfig:
    title: str | None = None
    description: str | None = None
    manual_entries: list[dict[str, str]] = field(default_factory=list)
    exclude_routes: list[str] = field(default_factory=list)


@dataclass
class DiscoveryConfig:
    llms_txt: LlmsTxtConfig | bool = field(default_factory=LlmsTxtConfig)
    agent_json: bool = True
    webagents_md: bool = True
    agent_tools: bool = True


# ---------------------------------------------------------------------------
# Layer 2: Content
# ---------------------------------------------------------------------------


@dataclass
class ContentSignalsConfig:
    ai_train: bool = False
    ai_input: bool = True
    search: bool = True


@dataclass
class ContentConfig:
    markdown: bool = True
    signals: ContentSignalsConfig = field(default_factory=ContentSignalsConfig)
    exclude_from_markdown: list[str] = field(default_factory=list)
    token_header: bool = True
    md_url_suffix: bool = True
    strip_selectors: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Layer 3: Analytics
# ---------------------------------------------------------------------------

AnalyticsStorageDriver = Literal["sqlite", "postgres", "clickhouse", "webhook", "none"]


@dataclass
class AnalyticsConfig:
    enabled: bool = True
    storage: AnalyticsStorageDriver = "sqlite"
    connection_string: str | None = None
    track_llm_referrals: bool = True
    webhook_headers: dict[str, str] = field(default_factory=dict)
    batch_size: int = 50
    flush_interval_ms: int = 5000


# ---------------------------------------------------------------------------
# Layer 4: Access Control
# ---------------------------------------------------------------------------

AgentTypePolicy = Literal["deny-all", "allow-public", "allow-all"]


@dataclass
class RateLimitConfig:
    max_requests: int = 100
    window_seconds: int = 60
    key_by: Literal["identity", "ip", "ua"] = "identity"


@dataclass
class AccessConfig:
    deny: list[str] = field(default_factory=list)
    allow: list[str] = field(default_factory=list)
    agent_types: dict[AgentCategory | str, AgentTypePolicy] = field(
        default_factory=dict
    )
    operators: dict[str, AgentTypePolicy] = field(default_factory=dict)
    rate_limit: RateLimitConfig | None = None


# ---------------------------------------------------------------------------
# Layer 5: Privacy
# ---------------------------------------------------------------------------


@dataclass
class PrivacyConfig:
    enabled: bool = False
    additional_patterns: list[Any] = field(default_factory=list)  # list[re.Pattern]
    ner_enabled: bool = False
    reversible_tokenization: bool = False
    tokenization_secret: str | None = None
    apply_to_routes: list[str] = field(default_factory=lambda: ["**"])
    exclude_routes: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Layer 6: Tools
# ---------------------------------------------------------------------------


@dataclass
class ToolsConfig:
    enabled: bool = True
    base_path: str = "/agent"
    task_timeout_seconds: int = 300
    retain_results: bool = True
    result_retention_seconds: int = 86400


# ---------------------------------------------------------------------------
# Layer 7: Monetization
# ---------------------------------------------------------------------------

MonetizationNetwork = Literal["base-mainnet", "base-sepolia", "solana-mainnet"]


@dataclass
class X402RouteConfig:
    price: str | float
    network: MonetizationNetwork = "base-mainnet"
    description: str | None = None
    to: str | None = None


@dataclass
class MonetizationConfig:
    enabled: bool = False
    wallet_address: str | None = None
    network: MonetizationNetwork = "base-mainnet"
    routes: dict[str, X402RouteConfig] = field(default_factory=dict)
    fallback: Literal["tollbit"] | Literal[False] = False
    exempt: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Layer 8: Multi-Tenancy
# ---------------------------------------------------------------------------

OrmAdapter = Literal["sqlalchemy", "none"]


@dataclass
class MultiTenancyConfig:
    enabled: bool = False
    token_secret: str | None = None
    session_ttl_seconds: int = 3600
    orm_adapter: OrmAdapter = "none"
    authorization_page_path: str = "/agent-access"


# ---------------------------------------------------------------------------
# Root Config
# ---------------------------------------------------------------------------


@dataclass
class AgentFriendlyConfig:
    """
    Root configuration object for the agentfriendly Python SDK.

    Example:
        config = AgentFriendlyConfig(
            detection=DetectionConfig(proactive_markdown="known"),
            content=ContentConfig(markdown=True),
        )
    """

    detection: DetectionConfig = field(default_factory=DetectionConfig)
    discovery: DiscoveryConfig = field(default_factory=DiscoveryConfig)
    content: ContentConfig = field(default_factory=ContentConfig)
    analytics: AnalyticsConfig = field(default_factory=AnalyticsConfig)
    access: AccessConfig = field(default_factory=AccessConfig)
    privacy: PrivacyConfig = field(default_factory=PrivacyConfig)
    tools: ToolsConfig = field(default_factory=ToolsConfig)
    monetization: MonetizationConfig = field(default_factory=MonetizationConfig)
    multi_tenancy: MultiTenancyConfig = field(default_factory=MultiTenancyConfig)
    debug: bool = False
    min_agent_tier: TrustTier = "known-agent"
