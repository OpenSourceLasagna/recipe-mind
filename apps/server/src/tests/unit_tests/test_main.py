from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def _patch_lifespan_dependencies():
    """Prevent real API calls / nltk downloads during app lifespan."""
    with (
        patch("src.main.initialize_global_clients") as mock_init,
        patch("src.main.nltk.download") as mock_nltk,
    ):
        mock_init.return_value = None
        mock_nltk.return_value = True
        yield


@pytest.fixture(autouse=True)
def _set_test_env_vars(monkeypatch):
    """Override env vars before any src.main import happens."""
    monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
    monkeypatch.setenv("SUPABASE_KEY", "test-supabase-key")
    monkeypatch.setenv(
        "DATABASE_URL", "postgresql+asyncpg://user:pass@localhost/testdb"
    )
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-openai-key")
    monkeypatch.setenv("EMBEDDING_MODEL_NAME", "text-embedding-3-small")
    monkeypatch.setenv("EMBEDDING_SIZE", "1536")
    monkeypatch.setenv("LOCAL_EMBEDDING_MODEL_NAME", "nomic-ai/nomic-embed-text-v1.5")
    monkeypatch.setenv("LOCAL_EMBEDDING_SIZE", "768")
    monkeypatch.setenv("DEBUG", "false")
    monkeypatch.setenv("LOG_LEVEL", "INFO")
    monkeypatch.setenv("CORS_ORIGINS", '["http://localhost:4200"]')


@pytest.fixture(autouse=True)
def _reset_rate_limiters():
    from src.middleware.rate_limit import reset_all_rate_limiters

    reset_all_rate_limiters()
    yield
    reset_all_rate_limiters()


@pytest.fixture
def app(_patch_lifespan_dependencies, _set_test_env_vars) -> FastAPI:
    from src.main import app

    app.dependency_overrides.clear()
    return app


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    return TestClient(app)


@pytest.fixture
def db_healthy(monkeypatch):
    async def _check():
        return "healthy"

    monkeypatch.setattr("src.main._check_database", _check)


@pytest.fixture
def db_unhealthy(monkeypatch):
    async def _check():
        return "unhealthy"

    monkeypatch.setattr("src.main._check_database", _check)


@pytest.fixture
def openai_initialized(monkeypatch):
    from src.dependencies import clients as clients_module

    monkeypatch.setattr(clients_module, "openai_client", MagicMock(), raising=False)


@pytest.fixture
def openai_uninitialized(monkeypatch):
    from src.dependencies import clients as clients_module

    monkeypatch.delattr(clients_module, "openai_client", raising=False)


@pytest.fixture
def supabase_initialized(monkeypatch):
    from src.dependencies import clients as clients_module

    monkeypatch.setattr(clients_module, "supabase_client", MagicMock(), raising=False)


@pytest.fixture
def supabase_uninitialized(monkeypatch):
    from src.dependencies import clients as clients_module

    monkeypatch.delattr(clients_module, "supabase_client", raising=False)


@pytest.fixture
def all_healthy(
    db_healthy,
    openai_initialized,
    supabase_initialized,
):
    pass


class TestAppMetadata:
    def test_app_title(self, app: FastAPI):
        assert app.title == "Recipe Mind API"

    def test_app_version(self, app: FastAPI):
        assert app.version == "0.1.0"

    def test_app_description(self, app: FastAPI):
        assert "RAG-powered" in app.description

    def test_health_routes_registered(self, app: FastAPI):
        route_paths = [r.path for r in app.routes]
        assert "/health/live" in route_paths
        assert "/health/ready" in route_paths
        assert "/health" in route_paths
        assert "/" in route_paths

    def test_cors_middleware_configured(self, app: FastAPI):
        middlewares = [m.cls for m in app.user_middleware]
        from fastapi.middleware.cors import CORSMiddleware

        assert CORSMiddleware in middlewares

    def test_cors_methods_not_wildcard(self, app: FastAPI):
        from fastapi.middleware.cors import CORSMiddleware

        cors_mw = next(m for m in app.user_middleware if m.cls is CORSMiddleware)
        allowed = cors_mw.kwargs.get("allow_methods", [])
        assert "*" not in allowed
        assert "GET" in allowed
        assert "POST" in allowed
        assert "PATCH" in allowed
        assert "DELETE" in allowed
        assert "OPTIONS" in allowed

    def test_cors_headers_not_wildcard(self, app: FastAPI):
        from fastapi.middleware.cors import CORSMiddleware

        cors_mw = next(m for m in app.user_middleware if m.cls is CORSMiddleware)
        allowed = cors_mw.kwargs.get("allow_headers", [])
        assert "*" not in allowed
        assert "Authorization" in allowed
        assert "Content-Type" in allowed


class TestCorsStartupGuard:
    def test_wildcard_origin_with_credentials_raises(self):
        from src.main import _validate_cors_origins

        with pytest.raises(ValueError, match="not allowed with allow_credentials"):
            _validate_cors_origins({"*"})

    def test_explicit_origin_passes(self):
        from src.main import _validate_cors_origins

        _validate_cors_origins({"http://localhost:4200"})

    def test_empty_origins_passes(self):
        from src.main import _validate_cors_origins

        _validate_cors_origins(set())


class TestRootEndpoint:
    def test_root_returns_info(self, client: TestClient):
        response = client.get("/")

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Recipe Mind API"
        assert data["version"] == "0.1.0"
        assert data["docs"] == "/docs"
        assert data["health"]["live"] == "/health/live"
        assert data["health"]["ready"] == "/health/ready"


class TestLiveness:
    def test_live_returns_200(self, client: TestClient):
        response = client.get("/health/live")

        assert response.status_code == 200
        assert response.json() == {"status": "alive"}

    def test_live_does_not_query_database(self, client: TestClient, monkeypatch):
        called = {"db": False}

        async def _check():
            called["db"] = True
            return "healthy"

        monkeypatch.setattr("src.main._check_database", _check)

        client.get("/health/live")

        assert called["db"] is False


class TestReadinessAllHealthy:
    def test_ready_returns_200(self, client: TestClient, all_healthy):
        response = client.get("/health/ready")

        assert response.status_code == 200
        data = response.json()
        assert data == {
            "status": "ready",
            "database": "healthy",
            "ai": "healthy",
            "supabase": "healthy",
        }


class TestReadinessDatabaseDown:
    def test_db_unhealthy_returns_503(
        self,
        client: TestClient,
        db_unhealthy,
        openai_initialized,
        supabase_initialized,
    ):
        response = client.get("/health/ready")

        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "not_ready"
        assert data["database"] == "unhealthy"
        assert data["ai"] == "healthy"
        assert data["supabase"] == "healthy"


class TestReadinessOpenAIDown:
    def test_openai_uninitialized_returns_503(
        self,
        client: TestClient,
        db_healthy,
        openai_uninitialized,
        supabase_initialized,
    ):
        response = client.get("/health/ready")

        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "not_ready"
        assert data["ai"] == "unhealthy"
        assert data["database"] == "healthy"
        assert data["supabase"] == "healthy"

    def test_openai_set_to_none_returns_503(
        self,
        client: TestClient,
        db_healthy,
        supabase_initialized,
        monkeypatch,
    ):
        from src.dependencies import clients as clients_module

        monkeypatch.setattr(clients_module, "openai_client", None, raising=False)

        response = client.get("/health/ready")

        assert response.status_code == 503
        assert response.json()["ai"] == "unhealthy"


class TestReadinessSupabaseDown:
    def test_supabase_uninitialized_returns_503(
        self,
        client: TestClient,
        db_healthy,
        openai_initialized,
        supabase_uninitialized,
    ):
        response = client.get("/health/ready")

        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "not_ready"
        assert data["supabase"] == "unhealthy"
        assert data["database"] == "healthy"
        assert data["ai"] == "healthy"


class TestHealthBackwardCompat:
    def test_legacy_health_path_aliases_ready(
        self,
        client: TestClient,
        all_healthy,
    ):
        response = client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ready"

    def test_legacy_health_returns_503_when_not_ready(
        self,
        client: TestClient,
        db_unhealthy,
        openai_initialized,
        supabase_initialized,
    ):
        response = client.get("/health")

        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "not_ready"


class TestExceptionHandlers:
    def test_http_exception_returns_json(self, client: TestClient):
        response = client.get("/nonexistent-route-12345")

        assert response.status_code == 404
        assert response.headers["content-type"] == "application/json"
        data = response.json()
        assert "detail" in data

    async def test_unhandled_exception_handler_returns_500(self, app: FastAPI):
        handler = app.exception_handlers[Exception]
        mock_req = MagicMock(spec=Request)
        mock_req.url.path = "/test"

        response = await handler(mock_req, ValueError("Something broke"))

        assert response.status_code == 500

    async def test_general_exception_handler_body(self, app: FastAPI):
        handler = app.exception_handlers[Exception]
        mock_req = MagicMock(spec=Request)
        mock_req.url.path = "/test"

        response = await handler(mock_req, ValueError("test error"))

        import json

        body = json.loads(response.body)
        assert body["detail"] == "Internal server error"
