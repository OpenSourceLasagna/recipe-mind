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
    monkeypatch.delenv("ENABLE_HSTS", raising=False)


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


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    return TestClient(app)


class TestSecurityHeadersAlwaysSet:
    def test_x_content_type_options(self, client: TestClient):
        response = client.get("/health/live")
        assert response.headers["X-Content-Type-Options"] == "nosniff"

    def test_x_frame_options(self, client: TestClient):
        response = client.get("/health/live")
        assert response.headers["X-Frame-Options"] == "DENY"

    def test_referrer_policy(self, client: TestClient):
        response = client.get("/health/live")
        assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"

    def test_permissions_policy(self, client: TestClient):
        response = client.get("/health/live")
        pp = response.headers["Permissions-Policy"]
        assert "geolocation=()" in pp
        assert "camera=()" in pp
        assert "microphone=()" in pp

    def test_content_security_policy(self, client: TestClient):
        response = client.get("/health/live")
        csp = response.headers["Content-Security-Policy"]
        assert "default-src 'self'" in csp
        assert "frame-ancestors 'none'" in csp
        assert "object-src 'none'" in csp

    def test_headers_on_error_response(self, client: TestClient):
        response = client.get("/nonexistent-route-12345")
        assert response.status_code == 404
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["X-Frame-Options"] == "DENY"

    def test_headers_on_401(self, app: FastAPI, monkeypatch):
        from src.dependencies.auth import get_current_user_id
        from fastapi.testclient import TestClient

        app.dependency_overrides.pop(get_current_user_id, None)
        c = TestClient(app)
        response = c.get("/v1/users/")
        assert response.status_code == 401
        assert response.headers["X-Content-Type-Options"] == "nosniff"


class TestSecurityHeadersHSTS:
    def test_hsts_not_set_by_default(self, client: TestClient):
        response = client.get("/health/live")
        assert "Strict-Transport-Security" not in response.headers

    def test_hsts_set_when_enabled(self, client: TestClient, monkeypatch):
        monkeypatch.setenv("ENABLE_HSTS", "true")
        from src.main import app
        from unittest.mock import MagicMock
        from src.dependencies.clients import (
            get_openai_client,
            get_supabase_client,
        )
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
        try:
            c = TestClient(app)
            response = c.get("/health/live")
            hsts = response.headers.get("Strict-Transport-Security", "")
            assert "max-age=63072000" in hsts
            assert "includeSubDomains" in hsts
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.parametrize("value", ["1", "true", "yes", "TRUE", "Yes"])
    def test_hsts_set_for_truthy_values(
        self, app: FastAPI, client: TestClient, monkeypatch, value
    ):
        monkeypatch.setenv("ENABLE_HSTS", value)
        from importlib import reload
        from src.middleware import security_headers

        reload(security_headers)
        try:
            c = TestClient(app)
            response = c.get("/health/live")
            assert "Strict-Transport-Security" in response.headers
        finally:
            reload(security_headers)

    def test_hsts_not_set_for_falsy_values(
        self, app: FastAPI, client: TestClient, monkeypatch
    ):
        monkeypatch.setenv("ENABLE_HSTS", "false")
        response = client.get("/health/live")
        assert "Strict-Transport-Security" not in response.headers
