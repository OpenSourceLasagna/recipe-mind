from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from supabase import Client


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
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost/testdb")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-openai-key")
    monkeypatch.setenv("EMBEDDING_MODEL_NAME", "text-embedding-3-small")
    monkeypatch.setenv("EMBEDDING_SIZE", "1536")
    monkeypatch.setenv("LOCAL_EMBEDDING_MODEL_NAME", "nomic-ai/nomic-embed-text-v1.5")
    monkeypatch.setenv("LOCAL_EMBEDDING_SIZE", "768")
    monkeypatch.setenv("DEBUG", "false")
    monkeypatch.setenv("LOG_LEVEL", "INFO")
    monkeypatch.setenv("CORS_ORIGINS", '["http://localhost:4200"]')


@pytest.fixture
def app(_patch_lifespan_dependencies, _set_test_env_vars) -> FastAPI:
    from src.main import app

    app.dependency_overrides.clear()
    return app


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    return TestClient(app)


@pytest.fixture
def mock_supabase_client() -> MagicMock:
    client = MagicMock(spec=Client)
    client.postgrest.from_table.return_value.select.return_value.limit.return_value.execute.return_value = (
        MagicMock()
    )
    return client


@pytest.fixture(autouse=True)
def _override_deps(app: FastAPI, mock_supabase_client: MagicMock):
    """Inject mocked Supabase/OpenAI clients into every test."""
    from src.dependencies.clients import get_supabase_client, get_openai_client

    mock_openai = MagicMock()
    mock_openai.models.list.return_value = {}

    app.dependency_overrides[get_supabase_client] = lambda: mock_supabase_client
    app.dependency_overrides[get_openai_client] = lambda: mock_openai
    yield
    app.dependency_overrides.clear()


class TestAppMetadata:
    def test_app_title(self, app: FastAPI):
        assert app.title == "Recipe Mind API"

    def test_app_version(self, app: FastAPI):
        assert app.version == "0.1.0"

    def test_app_description(self, app: FastAPI):
        assert "RAG-powered" in app.description

    def test_routers_registered(self, app: FastAPI):
        route_paths = [r.path for r in app.routes]
        assert "/health" in route_paths
        assert "/" in route_paths

    def test_cors_middleware_configured(self, app: FastAPI):
        middlewares = [m.cls for m in app.user_middleware]
        from fastapi.middleware.cors import CORSMiddleware

        assert CORSMiddleware in middlewares


class TestRootEndpoint:
    def test_root_returns_info(self, client: TestClient):
        response = client.get("/")

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Recipe Mind API"
        assert data["version"] == "0.1.0"
        assert data["docs"] == "/docs"
        assert data["health"] == "/health"


class TestHealthCheck:
    def test_health_healthy(self, client: TestClient, mock_supabase_client: MagicMock):
        response = client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["base_provider"] is True
        assert data["ai"] is True

    def test_health_supabase_unhealthy(
        self, client: TestClient, mock_supabase_client: MagicMock
    ):
        mock_supabase_client.postgrest.from_table.return_value.select.return_value.limit.return_value.execute.side_effect = Exception(
            "DB down"
        )

        response = client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert data["base_provider"] is False
        assert data["ai"] is True

    def test_health_openai_unhealthy(self, app: FastAPI, client: TestClient):
        from src.dependencies.clients import get_openai_client

        mock_openai_down = MagicMock()
        mock_openai_down.models.list.side_effect = Exception("AI down")
        app.dependency_overrides[get_openai_client] = lambda: mock_openai_down

        response = client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert data["base_provider"] is True
        assert data["ai"] is False

    def test_health_supabase_disconnected(
        self, app: FastAPI, client: TestClient
    ):
        from src.dependencies.clients import get_supabase_client

        app.dependency_overrides[get_supabase_client] = lambda: None

        response = client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["base_provider"] is False

    def test_health_openai_disconnected(self, app: FastAPI, client: TestClient):
        from src.dependencies.clients import get_openai_client

        app.dependency_overrides[get_openai_client] = lambda: None

        response = client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["base_provider"] is True
        assert data["ai"] is False


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

    def test_health_returns_snake_case_response(self, client: TestClient):
        response = client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert "base_provider" in data
        assert "status" in data
