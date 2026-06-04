from collections.abc import Callable
from typing import Any
from unittest.mock import AsyncMock, MagicMock, Mock
from uuid import UUID, uuid4

import numpy as np
import pytest
from fastapi import BackgroundTasks
from openai import OpenAI
from sqlmodel.ext.asyncio.session import AsyncSession

from src.database.repositories.ingredients_categories_repository import (
    IngredientCategoryRepository,
)
from src.database.repositories.recipe_ingredients_repository import (
    RecipeIngredientRepository,
)
from src.database.repositories.recipe_repository import RecipeRepository
from src.models.ingredient_category import IngredientCategory
from src.models.recipe import Recipe
from src.models.recipe_ingredient import RecipeIngredient
from src.services.category_matching_service import CategoryMatchingService
from src.services.embeddings.base_embedding_service import BaseEmbeddingService
from src.services.embeddings.embedding_service import EmbeddingService
from src.services.normalization_service import NormalizationService
from src.services.recipe_ingestion_service import RecipeIngestionService
from src.services.recipe_serializer import RecipeSerializerService


# ------------------------------------------------------------------ #
#  Fixtures: Model factories
# ------------------------------------------------------------------ #

@pytest.fixture
def recipe_id() -> UUID:
    return uuid4()


@pytest.fixture
def user_id() -> UUID:
    return uuid4()


@pytest.fixture
def ingredient_id() -> UUID:
    return uuid4()


@pytest.fixture
def category_id() -> UUID:
    return uuid4()


@pytest.fixture
def make_recipe(recipe_id: UUID, user_id: UUID) -> Callable[..., Recipe]:
    def _make(**overrides: Any) -> Recipe:
        defaults: dict[str, Any] = {
            "id": recipe_id,
            "user_id": user_id,
            "title": "Test Recipe",
            "difficulty": "medium",
            "origin": "Italian",
            "duration_minutes": 30,
            "servings": 4,
            "spice_level": 2,
            "nutrition": {"calories": 500},
            "additional_information": ["gluten-free"],
            "instruction_steps": ["Step one", "Step two"],
            "embedding": [0.1, 0.2, 0.3],
            "raw_source": "https://example.com/recipe",
            "ingredients": [],
        }
        defaults.update(overrides)
        return Recipe(**defaults)

    return _make


@pytest.fixture
def make_ingredient(
    ingredient_id: UUID, recipe_id: UUID
) -> Callable[..., RecipeIngredient]:
    def _make(**overrides: Any) -> RecipeIngredient:
        defaults: dict[str, Any] = {
            "id": ingredient_id,
            "recipe_id": recipe_id,
            "ingredient_name": "tomato",
            "normalized_name": "tomato",
            "quantity": 2.0,
            "unit": "cups",
            "embedding": [0.5, 0.5, 0.5],
            "category_id": None,
        }
        defaults.update(overrides)
        return RecipeIngredient(**defaults)

    return _make


@pytest.fixture
def make_category(category_id: UUID, ingredient_id: UUID) -> Callable[..., IngredientCategory]:
    def _make(**overrides: Any) -> IngredientCategory:
        defaults: dict[str, Any] = {
            "id": category_id,
            "category_name": "Vegetables",
            "centroid_id": ingredient_id,
        }
        defaults.update(overrides)
        return IngredientCategory(**defaults)

    return _make


# ------------------------------------------------------------------ #
#  Fixtures: Embedding vector helpers
# ------------------------------------------------------------------ #

@pytest.fixture
def embedding_vector() -> list[float]:
    rng = np.random.default_rng(42)
    vec = rng.uniform(-1, 1, 768).tolist()
    norm = np.linalg.norm(vec)
    return (np.array(vec) / norm).tolist()


@pytest.fixture
def embedding_vector_small() -> list[float]:
    rng = np.random.default_rng(1)
    vec = rng.uniform(-1, 1, 768).tolist()
    norm = np.linalg.norm(vec)
    return (np.array(vec) / norm).tolist()


# ------------------------------------------------------------------ #
#  Fixtures: Mock session & repositories
# ------------------------------------------------------------------ #


@pytest.fixture
def mock_session() -> AsyncMock:
    session = AsyncMock(spec=AsyncSession)

    exec_result = MagicMock()
    exec_result.all = MagicMock(return_value=[])
    exec_result.one_or_none = MagicMock(return_value=None)

    session.exec = AsyncMock(return_value=exec_result)
    session.add = Mock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.get = AsyncMock()
    session.close = AsyncMock()
    return session


@pytest.fixture
def recipe_repo(mock_session: AsyncMock) -> RecipeRepository:
    return RecipeRepository(a_session=mock_session)


@pytest.fixture
def ingredient_repo(mock_session: AsyncMock) -> RecipeIngredientRepository:
    return RecipeIngredientRepository(a_session=mock_session)


@pytest.fixture
def category_repo(mock_session: AsyncMock) -> IngredientCategoryRepository:
    return IngredientCategoryRepository(a_session=mock_session)


# ------------------------------------------------------------------ #
#  Fixtures: Mock embedding services
# ------------------------------------------------------------------ #


@pytest.fixture
def mock_embedder() -> MagicMock:
    embedder = MagicMock(spec=BaseEmbeddingService)
    embedder.embed = Mock(return_value=[0.1, 0.2, 0.3])
    embedder.embed_many = Mock(
        return_value=[[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]
    )
    return embedder


@pytest.fixture
def mock_small_embedder() -> MagicMock:
    embedder = MagicMock(spec=BaseEmbeddingService)
    embedder.embed = Mock(return_value=[0.7, 0.8, 0.9])
    embedder.embed_many = Mock(
        return_value=[[0.7, 0.8, 0.9], [0.1, 0.2, 0.3]]
    )
    return embedder


# ------------------------------------------------------------------ #
#  Fixtures: Mock OpenAI
# ------------------------------------------------------------------ #


@pytest.fixture
def mock_openai_client() -> MagicMock:
    client = MagicMock(spec=OpenAI)
    chat_completion = MagicMock()
    choice = MagicMock()
    choice.message.content = '{"0": "Vegetables", "1": "Spices"}'
    chat_completion.choices = [choice]
    client.chat.completions.create = Mock(return_value=chat_completion)
    return client


@pytest.fixture
def mock_openai_embedding_client() -> MagicMock:
    client = MagicMock(spec=OpenAI)
    embedding_data = MagicMock()
    embedding_data.data = [
        MagicMock(embedding=[0.1, 0.2, 0.3]),
        MagicMock(embedding=[0.4, 0.5, 0.6]),
    ]
    client.embeddings.create = Mock(return_value=embedding_data)
    return client


# ------------------------------------------------------------------ #
#  Fixtures: Normalization & Preprocessing services
# ------------------------------------------------------------------ #


@pytest.fixture
def normalization_service() -> NormalizationService:
    return NormalizationService()


@pytest.fixture
def mock_normalizer() -> MagicMock:
    normalizer = MagicMock(spec=NormalizationService)
    normalizer.normalize_word = Mock(side_effect=lambda w: w.strip().lower())
    return normalizer


@pytest.fixture
def preprocessor() -> RecipeSerializerService:
    return RecipeSerializerService()


# ------------------------------------------------------------------ #
#  Fixtures: BackgroundTasks
# ------------------------------------------------------------------ #


@pytest.fixture
def background_tasks() -> MagicMock:
    return MagicMock(spec=BackgroundTasks)


# ------------------------------------------------------------------ #
#  Fixtures: CategoryMatchingService dependency helpers
# ------------------------------------------------------------------ #


@pytest.fixture
def mock_session_factory(mock_session: AsyncMock) -> MagicMock:
    factory = MagicMock()
    factory.return_value.__aenter__.return_value = mock_session
    factory.return_value.__aexit__.return_value = None
    return factory


@pytest.fixture
def category_matcher(
    mock_embedder: MagicMock,
    mock_session_factory: MagicMock,
    mock_openai_client: MagicMock,
) -> CategoryMatchingService:
    return CategoryMatchingService(
        embedding_model=mock_embedder,
        session_factory=mock_session_factory,
        openai_client=mock_openai_client,
    )


@pytest.fixture
def category_matcher_no_openai(
    mock_embedder: MagicMock,
    mock_session_factory: MagicMock,
) -> CategoryMatchingService:
    return CategoryMatchingService(
        embedding_model=mock_embedder,
        session_factory=mock_session_factory,
        openai_client=None,
    )


# ------------------------------------------------------------------ #
#  Fixtures: RecipeIngestionService
# ------------------------------------------------------------------ #


@pytest.fixture
def ingestion_service(
    recipe_repo: RecipeRepository,
    mock_embedder: MagicMock,
    mock_small_embedder: MagicMock,
    preprocessor: RecipeSerializerService,
    category_matcher: CategoryMatchingService,
    mock_normalizer: MagicMock,
) -> RecipeIngestionService:
    return RecipeIngestionService(
        repo=recipe_repo,
        embedder=mock_embedder,
        small_embedder=mock_small_embedder,
        preprocessor=preprocessor,
        category_matcher=category_matcher,
        normalizer=mock_normalizer,
    )


# ------------------------------------------------------------------ #
#  Fixtures: Embedding Service tests
# ------------------------------------------------------------------ #


@pytest.fixture
def mock_settings() -> MagicMock:
    settings = MagicMock()
    settings.embedding_model_name = "text-embedding-3-small"
    settings.local_model_path = "./models"
    settings.local_embedding_model_name = "nomic-ai/nomic-embed-text-v1.5"
    settings.reranking_model_name = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    return settings


@pytest.fixture
def embedding_service(
    mock_openai_embedding_client: MagicMock, mock_settings: MagicMock
) -> EmbeddingService:
    return EmbeddingService(
        client=mock_openai_embedding_client,
        settings=mock_settings,
    )


# ------------------------------------------------------------------ #
#  Fixtures: CategoryMatchingService complex scenarios
# ------------------------------------------------------------------ #


@pytest.fixture
def categorized_ingredients(
    make_ingredient: Callable[..., RecipeIngredient],
) -> list[RecipeIngredient]:
    return [
        make_ingredient(
            normalized_name="tomato",
            category_id=uuid4(),
            embedding=[0.5, 0.5, 0.5],
        ),
        make_ingredient(
            normalized_name="onion",
            category_id=uuid4(),
            embedding=[0.6, 0.6, 0.6],
        ),
    ]


@pytest.fixture
def uncategorized_ingredients(
    make_ingredient: Callable[..., RecipeIngredient],
) -> list[RecipeIngredient]:
    return [
        make_ingredient(ingredient_name="tomato", normalized_name="tomato", category_id=None),
        make_ingredient(ingredient_name="basil", normalized_name="basil", category_id=None),
    ]


@pytest.fixture
def singleton_ingredients(
    make_ingredient: Callable[..., RecipeIngredient],
) -> list[RecipeIngredient]:
    rng = np.random.default_rng(99)
    return [
        make_ingredient(
            ingredient_name="rare_spice",
            normalized_name="rare_spice",
            embedding=(rng.uniform(-1, 1, 768) / np.linalg.norm(rng.uniform(-1, 1, 768))).tolist(),
            category_id=None,
        )
    ]


@pytest.fixture
def centroids(
    make_ingredient: Callable[..., RecipeIngredient], category_id: UUID
) -> list[RecipeIngredient]:
    return [
        make_ingredient(
            normalized_name="tomato",
            category_id=category_id,
            embedding=[0.5, 0.5, 0.5],
        )
    ]
