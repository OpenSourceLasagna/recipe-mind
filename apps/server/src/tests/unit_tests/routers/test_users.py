from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from src.schemas.user import UpdateUserRequest


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
def authenticated_user_id() -> UUID:
    return uuid4()


@pytest.fixture
def app(authenticated_user_id: UUID) -> FastAPI:
    from src.main import app
    from src.dependencies.auth import get_current_user_id

    app.dependency_overrides.clear()
    app.dependency_overrides[get_current_user_id] = lambda: authenticated_user_id
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
def unauth_app(monkeypatch) -> FastAPI:
    from src.main import app
    from src.dependencies import clients as clients_module
    from unittest.mock import MagicMock

    app.dependency_overrides.clear()
    monkeypatch.setattr(clients_module, "supabase_client", MagicMock(), raising=False)
    monkeypatch.setattr(clients_module, "openai_client", MagicMock(), raising=False)
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    return TestClient(app)


class TestGetCurrentUser:
    def test_returns_200_for_authenticated(self, client: TestClient):
        response = client.get("/v1/users/")

        assert response.status_code == 200
        assert response.json() == {"message": "Current user information"}


class TestGetUserById:
    def test_returns_200_for_own_id(
        self, client: TestClient, authenticated_user_id: UUID
    ):
        response = client.get(f"/v1/users/{authenticated_user_id}")

        assert response.status_code == 200

    def test_returns_403_for_other_user_id(self, client: TestClient):
        other_id = uuid4()

        response = client.get(f"/v1/users/{other_id}")

        assert response.status_code == 403
        assert response.json()["detail"] == "Not authorized to access this user"

    def test_does_not_echo_target_user_id_in_error(self, client: TestClient):
        target = uuid4()

        response = client.get(f"/v1/users/{target}")

        assert response.status_code == 403
        assert str(target) not in response.json()["detail"]

    def test_returns_401_without_auth(self, unauth_app: FastAPI):
        client = TestClient(unauth_app)

        response = client.get(f"/v1/users/{uuid4()}")

        assert response.status_code == 401
        assert response.json()["detail"] == "Authentication failed"


class TestUpdateUser:
    def test_returns_200_for_valid_request(self, client: TestClient):
        response = client.put("/v1/users/", json={"display_name": "Test User"})

        assert response.status_code == 200
        body = response.json()
        assert "updated" in body["message"].lower()

    def test_accepts_empty_body(self, client: TestClient):
        response = client.put("/v1/users/", json={})

        assert response.status_code == 200

    def test_rejects_extra_fields(self, client: TestClient):
        response = client.put(
            "/v1/users/",
            json={"display_name": "Test", "is_admin": True},
        )

        assert response.status_code == 422

    def test_rejects_body_user_id_field(self, client: TestClient):
        response = client.put(
            "/v1/users/",
            json={
                "user_id": str(uuid4()),
                "display_name": "Test",
            },
        )

        assert response.status_code == 422

    def test_rejects_oversized_display_name(self, client: TestClient):
        response = client.put("/v1/users/", json={"display_name": "x" * 101})

        assert response.status_code == 422

    def test_returns_401_without_auth(self, unauth_app: FastAPI):
        client = TestClient(unauth_app)

        response = client.put("/v1/users/", json={"display_name": "Test"})

        assert response.status_code == 401
        assert response.json()["detail"] == "Authentication failed"


class TestUpdateUserRequestSchema:
    def test_extra_forbid_at_schema_level(self):
        with pytest.raises(ValidationError):
            UpdateUserRequest(display_name="Test", is_admin=True)

    def test_optional_fields_default_to_none(self):
        req = UpdateUserRequest()

        assert req.display_name is None
        assert req.bio is None

    def test_display_name_max_length_enforced(self):
        with pytest.raises(ValidationError):
            UpdateUserRequest(display_name="x" * 101)

    def test_bio_max_length_enforced(self):
        with pytest.raises(ValidationError):
            UpdateUserRequest(bio="x" * 501)
