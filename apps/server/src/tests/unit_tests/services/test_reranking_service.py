from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from src.models.recipe import Recipe
from src.services.recipe_preprocessor_service import RecipePreprocessorService
from src.services.search.reranking_service import RerankingService
from src.services.search.types import ScoredRecipe


def _make_recipe(**overrides) -> Recipe:
    defaults = dict(
        id=uuid4(),
        user_id=uuid4(),
        title="Test",
        difficulty="easy",
        origin="Italian",
        duration_minutes=10,
        servings=2,
        spice_level=1,
        is_public=True,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    defaults.update(overrides)
    return Recipe(**defaults)


def _make_scored_recipe(**overrides) -> ScoredRecipe:
    defaults = dict(
        recipe=_make_recipe(),
        vector_score=0.8,
        fts_score=3.5,
        combined_score=0.65,
    )
    defaults.update(overrides)
    return ScoredRecipe(**defaults)


@pytest.fixture
def mock_preprocessor() -> MagicMock:
    preprocessor = MagicMock(spec=RecipePreprocessorService)
    preprocessor.to_markdown = MagicMock(return_value="markdown")
    return preprocessor


class TestRerankingService:
    @pytest.fixture(autouse=True)
    def _patch_cross_encoder_and_path(self):
        with patch(
            "src.services.search.reranking_service.get_save_cross_encoder_path"
        ) as mock_get_path, patch(
            "src.services.search.reranking_service.CrossEncoder", autospec=True
        ) as MockCE:
            mock_get_path.return_value = Path("/fake/models/cross-encoder")
            self.mock_model = MockCE.return_value
            yield

    def test_rerank_empty_list(self, mock_preprocessor):
        service = RerankingService(
            recipe_preprocessor=mock_preprocessor,
            below_best_match_threshold=4.0,
            general_acceptance_threshold=-7.0,
        )
        result = service.rerank([], "query")
        assert result == []

    def test_rerank_returns_recipes_not_scored(self, mock_preprocessor):
        r1 = _make_recipe(title="A")
        r2 = _make_recipe(title="B")
        scored = [_make_scored_recipe(recipe=r1), _make_scored_recipe(recipe=r2)]

        self.mock_model.rank = MagicMock(
            return_value=[
                {"corpus_id": 0, "score": 5.0},
                {"corpus_id": 1, "score": 3.0},
            ]
        )

        service = RerankingService(
            recipe_preprocessor=mock_preprocessor,
            below_best_match_threshold=4.0,
            general_acceptance_threshold=-7.0,
        )
        result = service.rerank(scored, "query")

        assert isinstance(result, list)
        assert all(isinstance(r, Recipe) for r in result)
        assert len(result) == 2
        assert result[0].title == "A"
        assert result[1].title == "B"

    def test_rerank_filters_below_acceptance_threshold(self, mock_preprocessor):
        r1 = _make_recipe(title="A")
        r2 = _make_recipe(title="B")
        scored = [_make_scored_recipe(recipe=r1), _make_scored_recipe(recipe=r2)]

        self.mock_model.rank = MagicMock(
            return_value=[
                {"corpus_id": 0, "score": -10.0},
                {"corpus_id": 1, "score": -8.0},
            ]
        )

        service = RerankingService(
            recipe_preprocessor=mock_preprocessor,
            below_best_match_threshold=4.0,
            general_acceptance_threshold=-7.0,
        )
        result = service.rerank(scored, "query")

        assert result == []

    def test_rerank_filters_below_best_match_gap(self, mock_preprocessor):
        r1 = _make_recipe(title="A")
        r2 = _make_recipe(title="B")
        r3 = _make_recipe(title="C")
        scored = [
            _make_scored_recipe(recipe=r1),
            _make_scored_recipe(recipe=r2),
            _make_scored_recipe(recipe=r3),
        ]

        self.mock_model.rank = MagicMock(
            return_value=[
                {"corpus_id": 0, "score": 10.0},
                {"corpus_id": 1, "score": 7.0},
                {"corpus_id": 2, "score": 2.0},
            ]
        )

        service = RerankingService(
            recipe_preprocessor=mock_preprocessor,
            below_best_match_threshold=4.0,
            general_acceptance_threshold=-7.0,
        )
        result = service.rerank(scored, "query")

        assert len(result) == 2
        assert result[0].title == "A"
        assert result[1].title == "B"

    def test_rerank_dynamic_below_best_match_threshold(self, mock_preprocessor):
        r1 = _make_recipe(title="A")
        r2 = _make_recipe(title="B")
        r3 = _make_recipe(title="C")
        scored = [
            _make_scored_recipe(recipe=r1),
            _make_scored_recipe(recipe=r2),
            _make_scored_recipe(recipe=r3),
        ]

        self.mock_model.rank = MagicMock(
            return_value=[
                {"corpus_id": 0, "score": 10.0},
                {"corpus_id": 1, "score": 7.0},
                {"corpus_id": 2, "score": 2.0},
            ]
        )

        service = RerankingService(
            recipe_preprocessor=mock_preprocessor,
            below_best_match_threshold=2.0,
            general_acceptance_threshold=-7.0,
        )
        result = service.rerank(scored, "query")

        assert len(result) == 1
        assert result[0].title == "A"

    def test_rerank_dynamic_general_acceptance_threshold(self, mock_preprocessor):
        r1 = _make_recipe(title="A")
        r2 = _make_recipe(title="B")
        scored = [
            _make_scored_recipe(recipe=r1),
            _make_scored_recipe(recipe=r2),
        ]

        self.mock_model.rank = MagicMock(
            return_value=[
                {"corpus_id": 0, "score": -5.0},
                {"corpus_id": 1, "score": -6.0},
            ]
        )

        service = RerankingService(
            recipe_preprocessor=mock_preprocessor,
            below_best_match_threshold=4.0,
            general_acceptance_threshold=-10.0,
        )
        result = service.rerank(scored, "query")

        assert len(result) == 2
        assert result[0].title == "A"
        assert result[1].title == "B"

    def test_rerank_single_item(self, mock_preprocessor):
        r1 = _make_recipe(title="A")
        scored = [_make_scored_recipe(recipe=r1)]

        self.mock_model.rank = MagicMock(
            return_value=[{"corpus_id": 0, "score": 5.0}]
        )

        service = RerankingService(
            recipe_preprocessor=mock_preprocessor,
            below_best_match_threshold=4.0,
            general_acceptance_threshold=-7.0,
        )
        result = service.rerank(scored, "query")

        assert len(result) == 1
        assert result[0].title == "A"
