from unittest.mock import patch
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def _patch_lifespan():
    with (
        patch("src.main.initialize_global_clients"),
        patch("src.main.nltk.download"),
    ):
        yield


@pytest.fixture(autouse=True)
def _set_env(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
    monkeypatch.setenv("SUPABASE_KEY", "test-key")
    monkeypatch.setenv(
        "DATABASE_URL", "postgresql+asyncpg://user:pass@localhost/testdb"
    )
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.setenv("CORS_ORIGINS", '["http://localhost:4200"]')
    monkeypatch.delenv("TRUSTED_HOSTS", raising=False)


@pytest.fixture(autouse=True)
def _reset_rate_limiters():
    from src.middleware.rate_limit import reset_all_rate_limiters

    reset_all_rate_limiters()
    yield
    reset_all_rate_limiters()


@pytest.fixture
def app() -> FastAPI:
    from src.main import app
    from unittest.mock import MagicMock
    from src.dependencies.clients import get_openai_client, get_supabase_client
    from src.dependencies.auth import get_current_user_id

    user_id = uuid4()
    app.dependency_overrides.clear()
    app.dependency_overrides[get_current_user_id] = lambda: user_id
    mock_supabase = MagicMock()
    mock_supabase.auth.get_claims = MagicMock(
        return_value={"claims": {"sub": str(user_id), "aud": "authenticated"}}
    )
    mock_openai = MagicMock()
    app.dependency_overrides[get_supabase_client] = lambda: mock_supabase
    app.dependency_overrides[get_openai_client] = lambda: mock_openai
    yield app
    app.dependency_overrides.clear()


class TestTrustedHostMiddlewareRegistration:
    def test_trusted_host_middleware_registered(self, app: FastAPI):
        from fastapi.middleware.trustedhost import TrustedHostMiddleware

        assert TrustedHostMiddleware in [m.cls for m in app.user_middleware]

    def test_default_allowed_hosts_is_wildcard(self, app: FastAPI):
        from fastapi.middleware.trustedhost import TrustedHostMiddleware

        middleware = next(
            m for m in app.user_middleware if m.cls is TrustedHostMiddleware
        )
        assert middleware.kwargs["allowed_hosts"] == ["*"]


class TestTrustedHostSettings:
    def test_settings_default_trusted_hosts(self):
        from src.schemas.settings import Settings

        s = Settings(
            supabase_url="https://test.supabase.co",
            supabase_key="test-key",
            database_url="postgresql+asyncpg://user:pass@localhost/testdb",
            openai_api_key="sk-test",
        )
        assert s.trusted_hosts == {"*"}

    def test_settings_accepts_explicit_trusted_hosts(self):
        from src.schemas.settings import Settings

        s = Settings(
            supabase_url="https://test.supabase.co",
            supabase_key="test-key",
            database_url="postgresql+asyncpg://user:pass@localhost/testdb",
            openai_api_key="sk-test",
            trusted_hosts={"api.example.com", "staging.example.com"},
        )
        assert s.trusted_hosts == {"api.example.com", "staging.example.com"}


class TestTrustedHostRuntime:
    def test_wildcard_allows_testserver(self, app: FastAPI):
        client = TestClient(app)
        response = client.get("/health/live")
        assert response.status_code == 200
