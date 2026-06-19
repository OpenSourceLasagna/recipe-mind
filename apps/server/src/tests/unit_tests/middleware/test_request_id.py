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


class TestRequestIdMiddleware:
    def test_request_id_middleware_registered(self, app: FastAPI):
        from src.middleware.request_id import RequestIdMiddleware

        assert RequestIdMiddleware in [m.cls for m in app.user_middleware]

    def test_generates_request_id_when_not_provided(self, app: FastAPI):
        client = TestClient(app)
        response = client.get("/health/live")

        request_id = response.headers.get("X-Request-Id")
        assert request_id is not None
        assert len(request_id) > 0

    def test_echoes_provided_request_id(self, app: FastAPI):
        client = TestClient(app)
        custom_id = "my-custom-request-id-12345"
        response = client.get("/health/live", headers={"X-Request-Id": custom_id})

        assert response.headers["X-Request-Id"] == custom_id

    def test_request_id_on_error_responses(self, app: FastAPI):
        client = TestClient(app)
        response = client.get("/nonexistent-route-12345")

        assert response.status_code == 404
        assert "X-Request-Id" in response.headers

    def test_request_id_on_500(self, app: FastAPI):
        from src.dependencies.auth import get_current_user_id

        def _raise():
            raise RuntimeError("boom-secret-internal-error")

        app.dependency_overrides[get_current_user_id] = _raise
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/v1/users/")

        assert response.status_code == 500
        assert "X-Request-Id" in response.headers
        assert response.json()["detail"] == "Internal server error"
        assert "boom-secret-internal-error" not in response.text


class TestValidationErrorHandler:
    def test_validation_error_returns_generic_body(self, app: FastAPI):
        client = TestClient(app)
        response = client.put("/v1/users/", json={"display_name": "x" * 1000})

        assert response.status_code == 422
        assert response.json() == {"detail": "Invalid request"}

    def test_validation_error_does_not_leak_request_body(self, app: FastAPI):
        client = TestClient(app)
        secret = "x" * 500
        response = client.put("/v1/users/", json={"display_name": secret})

        assert response.status_code == 422
        assert secret not in str(response.json())
