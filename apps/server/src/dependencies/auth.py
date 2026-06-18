import logging
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from ..observability import audit
from .clients import SupabaseClient

logger = logging.getLogger(__name__)

EXPECTED_AUDIENCE = "authenticated"
GENERIC_AUTH_FAILURE = "Authentication failed"

security = HTTPBearer(auto_error=False)


def _fail_auth(request: Request, reason: str) -> None:
    logger.warning("auth.%s", reason)
    audit.auth_failure(request, reason)
    raise HTTPException(status_code=401, detail=GENERIC_AUTH_FAILURE)


def get_current_user_id(
    request: Request,
    supabase_client: SupabaseClient,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> UUID:
    if credentials is None:
        _fail_auth(request, "missing_credentials")

    try:
        claims = supabase_client.auth.get_claims(credentials.credentials)
    except Exception:
        logger.warning("auth.supabase_verification_failed", exc_info=True)
        _fail_auth(request, "supabase_verification_failed")

    if not isinstance(claims, dict):
        _fail_auth(request, "claims_not_dict")

    payload = claims.get("claims")
    if not isinstance(payload, dict):
        _fail_auth(request, "payload_not_dict")

    aud = payload.get("aud")
    if aud != EXPECTED_AUDIENCE:
        _fail_auth(request, "wrong_audience")

    sub = payload.get("sub")
    if sub is None:
        _fail_auth(request, "missing_sub")

    try:
        return UUID(sub)
    except (ValueError, TypeError):
        logger.warning("auth.invalid_sub_uuid", exc_info=True)
        _fail_auth(request, "invalid_sub_uuid")

    raise HTTPException(status_code=401, detail=GENERIC_AUTH_FAILURE)


current_user_id_dep = Depends(get_current_user_id)
type CurrentUserID = Annotated[UUID, current_user_id_dep]
