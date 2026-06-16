from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from uuid import uuid4


@pytest.fixture(autouse=True)
def _patch_lifespan_dependencies():
    with (
        patch("src.main.initialize_global_clients") as mock_init,
        patch("src.main.nltk.download") as mock_nltk,
    ):
        mock_init.return_value = None
        mock_nltk.return_value = True
        yield


@pytest.fixture(autouse=True)
def _set_test_env_vars(monkeypatch):
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


@pytest.fixture
def app(_patch_lifespan_dependencies, _set_test_env_vars) -> FastAPI:
    from src.main import app

    app.dependency_overrides.clear()
    return app


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    return TestClient(app)


@pytest.fixture(autouse=True)
def _override_global_deps(app: FastAPI):
    """Override heavy/external dependencies so tests never hit real APIs."""
    from src.dependencies.clients import get_openai_client, get_supabase_client
    from src.dependencies.services import (
        get_moderation_service,
        get_prompt_guard_service,
    )

    mock_supabase = MagicMock()
    mock_supabase.postgrest.from_table.return_value.select.return_value.limit.return_value.execute.return_value = MagicMock()

    mock_openai = MagicMock()
    mock_openai.models.list.return_value = {}

    mock_guard = AsyncMock()
    mock_guard.is_safe.return_value = True

    mock_mod = AsyncMock()
    mock_mod.is_safe.return_value = True

    app.dependency_overrides[get_supabase_client] = lambda: mock_supabase
    app.dependency_overrides[get_openai_client] = lambda: mock_openai
    app.dependency_overrides[get_prompt_guard_service] = lambda: mock_guard
    app.dependency_overrides[get_moderation_service] = lambda: mock_mod
    yield
    app.dependency_overrides.clear()


class TestAIChefRouter:
    def test_chat_sse_format(self, app: FastAPI, client: TestClient):
        from src.dependencies.auth import get_current_user_id
        from src.dependencies.services import get_ai_chef_service
        from src.services.ai_chef.ai_chef_service import AIChefService

        async def _fake_stream(*args, **kwargs):
            from src.services.ai_chef.streaming_formatter import format_sse

            yield format_sse("status", {"status": "thinking", "detail": "..."})
            yield format_sse("text", {"text": "Hello!"})

        mock_service = MagicMock(spec=AIChefService)
        mock_service.stream_chat = _fake_stream

        app.dependency_overrides[get_ai_chef_service] = lambda: mock_service
        app.dependency_overrides[get_current_user_id] = lambda: uuid4()

        response = client.post(
            "/v1/ai-chef/chat",
            json={"message": "hello"},
            headers={"Authorization": "Bearer test-token"},
        )

        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")

        body = response.text
        assert "event: status" in body
        assert "event: text" in body

    def test_chat_unauthorized(self, app: FastAPI, client: TestClient):
        # No auth header -> expect 401
        response = client.post("/v1/ai-chef/chat", json={"message": "hello"})
        assert response.status_code == 401

    def test_chat_bad_token(self, app: FastAPI, client: TestClient):
        # Bad token -> mocked Supabase returns MagicMocks that can't be parsed as UUID
        response = client.post(
            "/v1/ai-chef/chat",
            json={"message": "hello"},
            headers={"Authorization": "Bearer bad-token"},
        )
        assert response.status_code == 401
