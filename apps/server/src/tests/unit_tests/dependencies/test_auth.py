from datetime import datetime, timedelta, timezone
from logging import WARNING
from typing import Any
from unittest.mock import MagicMock
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from src.dependencies.auth import get_current_user_id


_EXPECTED_AUDIENCE = "authenticated"
_GENERIC_BODY = "Authentication failed"
_SENTINEL: Any = object()

_SENSITIVE_LEAKS = (
    "internal supabase secret",
    "api-key-12345",
    "Bearer eyJhbGc",
    "RuntimeError",
    "network down",
    "secret",
    "token",
)


def _credentials(token: str = "fake-token") -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def _valid_claims(
    user_id: UUID | None = None,
    *,
    aud: str = _EXPECTED_AUDIENCE,
    exp_offset: int = 3600,
    sub: Any = _SENTINEL,
) -> dict[str, Any]:
    if user_id is None:
        user_id = uuid4()
    if sub is _SENTINEL:
        sub = str(user_id)
    now = datetime.now(timezone.utc)
    return {
        "claims": {
            "sub": sub,
            "aud": aud,
            "iss": "https://test.supabase.co/auth/v1",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(seconds=exp_offset)).timestamp()),
        }
    }


class TestGetCurrentUserIdSuccess:
    def test_returns_user_id_from_valid_claims(self):
        user_id = uuid4()
        client = MagicMock()
        client.auth.get_claims.return_value = _valid_claims(user_id)
        request = MagicMock()

        result = get_current_user_id(request, client, _credentials())

        assert result == user_id
        client.auth.get_claims.assert_called_once_with("fake-token")


class TestGetCurrentUserIdNoLeak:
    @pytest.mark.parametrize("sensitive", _SENSITIVE_LEAKS)
    def test_exception_text_never_in_response(self, sensitive):
        client = MagicMock()
        client.auth.get_claims.side_effect = RuntimeError(sensitive)

        with pytest.raises(HTTPException) as exc:
            get_current_user_id(client, _credentials())

        assert exc.value.status_code == 401
        assert exc.value.detail == _GENERIC_BODY
        assert sensitive not in exc.value.detail

    def test_claims_none_returns_generic_401(self):
        client = MagicMock()
        client.auth.get_claims.return_value = None

        with pytest.raises(HTTPException) as exc:
            get_current_user_id(client, _credentials())

        assert exc.value.status_code == 401
        assert exc.value.detail == _GENERIC_BODY

    def test_inner_claims_none_returns_generic_401(self):
        client = MagicMock()
        client.auth.get_claims.return_value = {"claims": None}

        with pytest.raises(HTTPException) as exc:
            get_current_user_id(client, _credentials())

        assert exc.value.status_code == 401
        assert exc.value.detail == _GENERIC_BODY

    def test_claims_not_dict_returns_generic_401(self):
        client = MagicMock()
        client.auth.get_claims.return_value = "not a dict"

        with pytest.raises(HTTPException) as exc:
            get_current_user_id(client, _credentials())

        assert exc.value.status_code == 401
        assert exc.value.detail == _GENERIC_BODY

    def test_missing_sub_returns_generic_401(self):
        client = MagicMock()
        claims = _valid_claims()
        del claims["claims"]["sub"]
        client.auth.get_claims.return_value = claims

        with pytest.raises(HTTPException) as exc:
            get_current_user_id(client, _credentials())

        assert exc.value.status_code == 401
        assert exc.value.detail == _GENERIC_BODY

    def test_sub_is_none_returns_generic_401(self):
        client = MagicMock()
        client.auth.get_claims.return_value = _valid_claims(sub=None)

        with pytest.raises(HTTPException) as exc:
            get_current_user_id(client, _credentials())

        assert exc.value.status_code == 401
        assert exc.value.detail == _GENERIC_BODY

    def test_malformed_sub_uuid_returns_generic_401(self):
        client = MagicMock()
        client.auth.get_claims.return_value = _valid_claims(sub="not-a-uuid")

        with pytest.raises(HTTPException) as exc:
            get_current_user_id(client, _credentials())

        assert exc.value.status_code == 401
        assert exc.value.detail == _GENERIC_BODY

    def test_exception_text_logged_server_side(self, caplog):
        client = MagicMock()
        client.auth.get_claims.side_effect = RuntimeError("internal supabase secret")
        request = MagicMock()

        with caplog.at_level(WARNING):
            with pytest.raises(HTTPException) as exc:
                get_current_user_id(request, client, _credentials())

        assert exc.value.detail == _GENERIC_BODY
        assert "internal supabase secret" in caplog.text


class TestGetCurrentUserIdAudienceValidation:
    def test_rejects_service_role_audience(self):
        client = MagicMock()
        client.auth.get_claims.return_value = _valid_claims(aud="service_role")

        with pytest.raises(HTTPException) as exc:
            get_current_user_id(client, _credentials())

        assert exc.value.status_code == 401
        assert exc.value.detail == _GENERIC_BODY

    def test_rejects_anon_audience(self):
        client = MagicMock()
        client.auth.get_claims.return_value = _valid_claims(aud="anon")

        with pytest.raises(HTTPException) as exc:
            get_current_user_id(client, _credentials())

        assert exc.value.status_code == 401
        assert exc.value.detail == _GENERIC_BODY

    def test_rejects_missing_audience(self):
        client = MagicMock()
        claims = _valid_claims()
        del claims["claims"]["aud"]
        client.auth.get_claims.return_value = claims

        with pytest.raises(HTTPException) as exc:
            get_current_user_id(client, _credentials())

        assert exc.value.status_code == 401
        assert exc.value.detail == _GENERIC_BODY


class TestGetCurrentUserIdMissingCredentials:
    def test_no_credentials_returns_generic_401(self):
        client = MagicMock()

        with pytest.raises(HTTPException) as exc:
            get_current_user_id(client, None)

        assert exc.value.status_code == 401
        assert exc.value.detail == _GENERIC_BODY
        client.auth.get_claims.assert_not_called()
