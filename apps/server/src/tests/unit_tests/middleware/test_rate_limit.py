from unittest.mock import patch
from uuid import UUID, uuid4

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
def user_id() -> UUID:
    return uuid4()


@pytest.fixture
def app(user_id: UUID) -> FastAPI:
    from src.main import app
    from src.dependencies.auth import get_current_user_id
    from src.dependencies.clients import get_openai_client, get_supabase_client
    from unittest.mock import MagicMock

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


def _db_healthy(monkeypatch):
    async def _check():
        return "healthy"

    monkeypatch.setattr("src.main._check_database", _check)


def _openai_ok(monkeypatch):
    from src.dependencies import clients as clients_module
    from unittest.mock import MagicMock

    monkeypatch.setattr(clients_module, "openai_client", MagicMock(), raising=False)


def _supabase_ok(monkeypatch):
    from src.dependencies import clients as clients_module
    from unittest.mock import MagicMock

    monkeypatch.setattr(clients_module, "supabase_client", MagicMock(), raising=False)


class TestHealthReadyRateLimit:
    def test_allows_under_limit(self, app: FastAPI, monkeypatch):
        _db_healthy(monkeypatch)
        _openai_ok(monkeypatch)
        _supabase_ok(monkeypatch)
        client = TestClient(app)

        for _ in range(10):
            response = client.get("/health/ready")
            assert response.status_code == 200

    def test_blocks_over_limit(self, app: FastAPI, monkeypatch):
        _db_healthy(monkeypatch)
        _openai_ok(monkeypatch)
        _supabase_ok(monkeypatch)
        client = TestClient(app)

        for _ in range(10):
            client.get("/health/ready")

        response = client.get("/health/ready")
        assert response.status_code == 429
        assert "Rate limit exceeded" in response.json()["detail"]

    def test_does_not_rate_limit_liveness(self, app: FastAPI, monkeypatch):
        _db_healthy(monkeypatch)
        _openai_ok(monkeypatch)
        _supabase_ok(monkeypatch)
        client = TestClient(app)

        for _ in range(20):
            response = client.get("/health/live")
            assert response.status_code == 200

    def test_rate_limit_is_per_ip(self, app: FastAPI, monkeypatch):
        _db_healthy(monkeypatch)
        _openai_ok(monkeypatch)
        _supabase_ok(monkeypatch)
        client = TestClient(app)

        for _ in range(10):
            client.get("/health/ready")

        response = client.get("/health/ready", headers={"X-Forwarded-For": "10.0.0.1"})
        assert response.status_code == 200
