"""
Layer 8 — RFC 8693-inspired JWT Token Issuer (Python)

Mirrors packages/core/src/multitenancy/token-issuer.ts
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

from ..config import MultiTenancyConfig
from ..types import TenantContext

# In-memory CRL (Certificate Revocation List)
_REVOKED_SESSION_IDS: set[str] = set()


@dataclass
class TokenIssueResult:
    token: str
    session_id: str
    expires_at: str


@dataclass
class TokenValidationResult:
    valid: bool
    tenant_context: TenantContext | None
    error: str | None


def issue_delegation_token(
    *,
    tenant_id: str,
    user_id: str,
    scopes: list[str],
    config: MultiTenancyConfig,
) -> TokenIssueResult:
    """
    Issue a signed agent delegation token (JWT) for a specific user/tenant.
    Follows RFC 8693 `act` claim for user delegation.
    """
    if not config.token_secret:
        raise ValueError("MultiTenancyConfig.token_secret must be set to issue tokens")

    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=config.session_ttl_seconds)

    payload: dict[str, Any] = {
        "jti": session_id,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "sub": f"agent:{session_id}",
        "scope": " ".join(scopes),
        "act": {
            "sub": user_id,
            "tid": tenant_id,
        },
    }

    token = jwt.encode(payload, config.token_secret, algorithm="HS256")
    return TokenIssueResult(
        token=token,
        session_id=session_id,
        expires_at=expires_at.isoformat(),
    )


async def validate_delegation_token(
    token_header: str,
    config: MultiTenancyConfig,
) -> TokenValidationResult:
    """Validate an agent delegation token and extract tenant context."""
    if not config.token_secret:
        return TokenValidationResult(valid=False, tenant_context=None, error="No token secret configured")

    # Strip scheme prefix if present
    raw_token = token_header
    for prefix in ("Bearer ", "AgentSession ", "AgentToken "):
        if raw_token.startswith(prefix):
            raw_token = raw_token[len(prefix):]
            break

    try:
        payload = jwt.decode(
            raw_token,
            config.token_secret,
            algorithms=["HS256"],
        )
    except jwt.ExpiredSignatureError:
        return TokenValidationResult(valid=False, tenant_context=None, error="Token expired")
    except jwt.InvalidTokenError as e:
        return TokenValidationResult(valid=False, tenant_context=None, error=str(e))

    session_id = payload.get("jti", "")
    if session_id in _REVOKED_SESSION_IDS:
        return TokenValidationResult(valid=False, tenant_context=None, error="Session revoked")

    act = payload.get("act", {})
    tenant_id = act.get("tid", "")
    user_id = act.get("sub", "")
    scopes = payload.get("scope", "").split()
    exp = payload.get("exp", 0)
    expires_at = datetime.fromtimestamp(exp, tz=timezone.utc).isoformat()

    tenant_context = TenantContext(
        tenant_id=tenant_id,
        user_id=user_id,
        session_id=session_id,
        granted_scopes=tuple(scopes),
        expires_at=expires_at,
    )

    return TokenValidationResult(valid=True, tenant_context=tenant_context, error=None)


def revoke_session(session_id: str) -> None:
    """Add a session ID to the in-memory revocation list."""
    _REVOKED_SESSION_IDS.add(session_id)


def is_revoked(session_id: str) -> bool:
    """Check whether a session has been revoked."""
    return session_id in _REVOKED_SESSION_IDS
