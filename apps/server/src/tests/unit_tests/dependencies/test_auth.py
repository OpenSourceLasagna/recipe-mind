from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from src.dependencies.auth import get_current_user_id


def _make_credentials(token: str = "fake-token") -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


class TestGetCurrentUserId:
    def test_returns_user_id_from_valid_claims(self):
        user_id = uuid4()
        supabase_client = MagicMock()
        supabase_client.auth.get_claims.return_value = {"claims": {"sub": str(user_id)}}

        result = get_current_user_id(supabase_client, _make_credentials())

        assert result == user_id
        supabase_client.auth.get_claims.assert_called_once_with("fake-token")

    def test_raises_401_when_claims_is_none(self):
        supabase_client = MagicMock()
        supabase_client.auth.get_claims.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            get_current_user_id(supabase_client, _make_credentials())

        assert exc_info.value.status_code == 401
        assert "user not found" in exc_info.value.detail

    def test_raises_401_when_claims_dict_is_none(self):
        supabase_client = MagicMock()
        supabase_client.auth.get_claims.return_value = {"claims": None}

        with pytest.raises(HTTPException) as exc_info:
            get_current_user_id(supabase_client, _make_credentials())

        assert exc_info.value.status_code == 401

    def test_raises_401_when_sub_claim_missing(self):
        supabase_client = MagicMock()
        supabase_client.auth.get_claims.return_value = {"claims": {}}

        with pytest.raises(HTTPException) as exc_info:
            get_current_user_id(supabase_client, _make_credentials())

        assert exc_info.value.status_code == 401
        assert "user ID not found" in exc_info.value.detail

    def test_raises_401_when_sub_claim_is_none(self):
        supabase_client = MagicMock()
        supabase_client.auth.get_claims.return_value = {"claims": {"sub": None}}

        with pytest.raises(HTTPException) as exc_info:
            get_current_user_id(supabase_client, _make_credentials())

        assert exc_info.value.status_code == 401

    def test_raises_401_when_sub_claim_is_malformed_uuid(self):
        supabase_client = MagicMock()
        supabase_client.auth.get_claims.return_value = {"claims": {"sub": "not-a-uuid"}}

        with pytest.raises(HTTPException) as exc_info:
            get_current_user_id(supabase_client, _make_credentials())

        assert exc_info.value.status_code == 401
        assert "Authentication error" in exc_info.value.detail

    def test_wraps_unexpected_exception_as_401(self):
        supabase_client = MagicMock()
        supabase_client.auth.get_claims.side_effect = RuntimeError("network down")

        with pytest.raises(HTTPException) as exc_info:
            get_current_user_id(supabase_client, _make_credentials())

        assert exc_info.value.status_code == 401
        assert "network down" in exc_info.value.detail
