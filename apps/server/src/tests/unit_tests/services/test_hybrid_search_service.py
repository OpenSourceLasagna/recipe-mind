from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from src.models.recipe import Recipe
from src.schemas.search import SearchFilters
from src.services.search.hybrid_search_service import HybridSearchService


def _make_recipe(**overrides) -> Recipe:
    defaults = dict(
        id=uuid4(),
        user_id=uuid4(),
        title="Test Recipe",
        difficulty="medium",
        origin="Italian",
        duration_minutes=30,
        servings=4,
        spice_level=2,
        is_public=True,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    defaults.update(overrides)
    return Recipe(**defaults)


@pytest.fixture
def mock_repo() -> AsyncMock:
    repo = AsyncMock(spec=["search_by_vector", "search_by_fulltext", "get_by_ids"])
    return repo


@pytest.fixture
def mock_embedder() -> MagicMock:
    embedder = MagicMock()
    embedder.embed = MagicMock(return_value=[0.1, 0.2, 0.3])
    return embedder


@pytest.fixture
def mock_reranker() -> MagicMock:
    reranker = MagicMock()
    reranker.rerank = MagicMock(return_value=[])
    return reranker


@pytest.fixture
def mock_cache_repo() -> AsyncMock:
    repo = AsyncMock(spec=["get_by_query", "create"])
    repo.get_by_query = AsyncMock(return_value=None)
    repo.create = AsyncMock(return_value=None)
    return repo


@pytest.fixture
def service(mock_repo, mock_embedder, mock_reranker, mock_cache_repo) -> HybridSearchService:
    return HybridSearchService(
        recipe_repo=mock_repo,
        embedder=mock_embedder,
        reranker=mock_reranker,
        cache_repo=mock_cache_repo,
    )


def _uuids(n: int) -> list:
    return [uuid4() for _ in range(n)]


class TestNormalizeRange:
    def test_empty_dict_returns_safe_defaults(self):
        result = HybridSearchService._normalize_range({})
        assert result == (0.0, 0.0, 1.0)

    def test_single_value_returns_range_one(self):
        scores = {uuid4(): 0.5}
        min_val, max_val, rng = HybridSearchService._normalize_range(scores)
        assert min_val == 0.5
        assert max_val == 0.5
        assert rng == 1.0

    def test_multiple_values_returns_correct_range(self):
        uid = uuid4()
        uid2 = uuid4()
        scores = {uid: 0.2, uid2: 0.8}
        min_val, max_val, rng = HybridSearchService._normalize_range(scores)
        assert min_val == 0.2
        assert max_val == 0.8
        assert rng == pytest.approx(0.6)


class TestMergeResults:
    def test_merges_vector_and_fts_results(self, service):
        uid1, uid2, uid3 = _uuids(3)
        vector_results = [(uid1, 0.9), (uid2, 0.7)]
        fts_results = [(uid1, 5.0), (uid3, 3.0)]

        candidates = service._merge_results(vector_results, fts_results)

        by_id = {c.recipe_id: c for c in candidates}
        assert uid1 in by_id
        assert by_id[uid1].vector_score == 0.9
        assert by_id[uid1].fts_score == 5.0
        assert uid2 in by_id
        assert by_id[uid2].vector_score == 0.7
        assert by_id[uid2].fts_score is None
        assert uid3 in by_id
        assert by_id[uid3].vector_score is None
        assert by_id[uid3].fts_score == 3.0

    def test_combined_score_is_weighted_sum(self, service):
        uid1, uid2 = _uuids(2)
        vector_results = [(uid1, 0.8), (uid2, 0.4)]
        fts_results = [(uid1, 4.0), (uid2, 2.0)]

        candidates = service._merge_results(vector_results, fts_results)

        by_id = {c.recipe_id: c for c in candidates}
        c1 = by_id[uid1]
        c2 = by_id[uid2]

        assert c1.combined_score > c2.combined_score
        assert c1.combined_score == pytest.approx(
            HybridSearchService.VECTOR_WEIGHT * 1.0
            + HybridSearchService.FTS_WEIGHT * 1.0
        )
        normalized_c2_vec = (0.4 - 0.4) / 0.4 if 0.4 != 0.8 else 0.0
        assert c2.combined_score == pytest.approx(
            HybridSearchService.VECTOR_WEIGHT * normalized_c2_vec
            + HybridSearchService.FTS_WEIGHT * 0.0
        )

    def test_empty_both_inputs_returns_empty(self, service):
        candidates = service._merge_results([], [])
        assert candidates == []

    def test_vector_only_results(self, service):
        uid1, uid2 = uuid4(), uuid4()
        candidates = service._merge_results([(uid1, 0.9), (uid2, 0.5)], [])
        assert len(candidates) == 2
        by_id = {c.recipe_id: c for c in candidates}
        assert by_id[uid1].vector_score == 0.9
        assert by_id[uid1].fts_score is None
        assert by_id[uid1].combined_score > by_id[uid2].combined_score
        assert by_id[uid2].vector_score == 0.5

    def test_fts_only_results(self, service):
        uid1, uid2 = uuid4(), uuid4()
        candidates = service._merge_results([], [(uid1, 5.0), (uid2, 1.0)])
        assert len(candidates) == 2
        by_id = {c.recipe_id: c for c in candidates}
        assert by_id[uid1].vector_score is None
        assert by_id[uid1].fts_score == 5.0
        assert by_id[uid1].combined_score > by_id[uid2].combined_score
        assert by_id[uid2].fts_score == 1.0

    def test_results_sorted_by_combined_score_desc(self, service):
        uid1, uid2 = _uuids(2)
        vector_results = [(uid1, 0.9), (uid2, 0.1)]
        fts_results = [(uid1, 5.0), (uid2, 1.0)]

        candidates = service._merge_results(vector_results, fts_results)
        scores = [c.combined_score for c in candidates]
        assert scores == sorted(scores, reverse=True)


class TestSearch:
    @pytest.mark.asyncio
    async def test_search_calls_embedder_with_query(
        self, service, mock_embedder, mock_repo, mock_cache_repo
    ):
        uid = uuid4()
        recipe = _make_recipe(id=uid)
        mock_repo.search_by_vector = AsyncMock(return_value=[(uid, 0.9)])
        mock_repo.search_by_fulltext = AsyncMock(return_value=[(uid, 3.0)])
        mock_repo.get_by_ids = AsyncMock(return_value=[recipe])

        await service.search(
            user_id=uuid4(), query_text="chicken pasta", filters=SearchFilters()
        )

        mock_cache_repo.get_by_query.assert_awaited_once_with("chicken pasta")
        mock_embedder.embed.assert_called_once_with("chicken pasta")

    @pytest.mark.asyncio
    async def test_search_uses_cached_embedding_when_cache_hit(
        self, mock_repo, mock_embedder, mock_reranker, mock_cache_repo
    ):
        cached_embedding = [0.5, 0.5, 0.5]
        cached_entry = MagicMock()
        cached_entry.embedding = cached_embedding
        mock_cache_repo.get_by_query = AsyncMock(return_value=cached_entry)

        service = HybridSearchService(
            recipe_repo=mock_repo,
            embedder=mock_embedder,
            reranker=mock_reranker,
            cache_repo=mock_cache_repo,
        )

        uid = uuid4()
        recipe = _make_recipe(id=uid)
        mock_repo.search_by_vector = AsyncMock(return_value=[(uid, 0.9)])
        mock_repo.search_by_fulltext = AsyncMock(return_value=[(uid, 3.0)])
        mock_repo.get_by_ids = AsyncMock(return_value=[recipe])

        await service.search(
            user_id=uuid4(), query_text="chicken pasta", filters=SearchFilters()
        )

        mock_cache_repo.get_by_query.assert_awaited_once_with("chicken pasta")
        mock_embedder.embed.assert_not_called()
        mock_repo.search_by_vector.assert_awaited_once()
        called_embedding = mock_repo.search_by_vector.call_args.kwargs["embedding"]
        assert called_embedding == cached_embedding

    @pytest.mark.asyncio
    async def test_search_calls_both_repos_with_same_filters(self, service, mock_repo):
        uid = uuid4()
        recipe = _make_recipe(id=uid)
        mock_repo.search_by_vector = AsyncMock(return_value=[(uid, 0.9)])
        mock_repo.search_by_fulltext = AsyncMock(return_value=[(uid, 3.0)])
        mock_repo.get_by_ids = AsyncMock(return_value=[recipe])

        filters = SearchFilters(difficulty="easy", duration_min=10)
        await service.search(user_id=uuid4(), query_text="test query", filters=filters)

        vector_call_filters = mock_repo.search_by_vector.call_args.kwargs["filters"]
        fts_call_filters = mock_repo.search_by_fulltext.call_args.kwargs["filters"]
        assert vector_call_filters is filters
        assert fts_call_filters is filters

    @pytest.mark.asyncio
    async def test_search_fetches_recipes_by_merged_ids(self, service, mock_repo):
        uid1, uid2 = _uuids(2)
        r1 = _make_recipe(id=uid1)
        r2 = _make_recipe(id=uid2)
        mock_repo.search_by_vector = AsyncMock(return_value=[(uid1, 0.9)])
        mock_repo.search_by_fulltext = AsyncMock(return_value=[(uid2, 3.0)])
        mock_repo.get_by_ids = AsyncMock(return_value=[r1, r2])

        await service.search(
            user_id=uuid4(), query_text="test", filters=SearchFilters()
        )

        called_ids = mock_repo.get_by_ids.call_args.args[0]
        assert set(called_ids) == {uid1, uid2}

    @pytest.mark.asyncio
    async def test_search_applies_reranker(self, service, mock_repo, mock_reranker):
        uid = uuid4()
        recipe = _make_recipe(id=uid)
        mock_repo.search_by_vector = AsyncMock(return_value=[(uid, 0.9)])
        mock_repo.search_by_fulltext = AsyncMock(return_value=[(uid, 3.0)])
        mock_repo.get_by_ids = AsyncMock(return_value=[recipe])

        reranker_spy = MagicMock(wrap=mock_reranker)
        service._reranker = reranker_spy

        await service.search(
            user_id=uuid4(), query_text="test", filters=SearchFilters()
        )

        reranker_spy.rerank.assert_called_once()

    @pytest.mark.asyncio
    async def test_search_paginates_results(self, service, mock_repo, mock_reranker):
        uids = _uuids(5)
        recipes = [_make_recipe(id=uid) for uid in uids]
        vector_results = [(uid, 0.5 + i * 0.1) for i, uid in enumerate(uids)]
        mock_repo.search_by_vector = AsyncMock(return_value=vector_results)
        mock_repo.search_by_fulltext = AsyncMock(return_value=[])
        mock_repo.get_by_ids = AsyncMock(return_value=recipes)

        mock_reranker.rerank = MagicMock(return_value=recipes)

        result, total = await service.search(
            user_id=uuid4(),
            query_text="test",
            filters=SearchFilters(),
            sort_by="relevance",
            sort_order="desc",
            page=2,
            page_size=2,
        )

        assert total == 5
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_search_returns_total_count_before_pagination(
        self, service, mock_repo, mock_reranker
    ):
        uids = _uuids(3)
        recipes = [_make_recipe(id=uid) for uid in uids]
        mock_repo.search_by_vector = AsyncMock(
            return_value=[(uid, 0.9) for uid in uids]
        )
        mock_repo.search_by_fulltext = AsyncMock(return_value=[])
        mock_repo.get_by_ids = AsyncMock(return_value=recipes)

        mock_reranker.rerank = MagicMock(return_value=recipes)

        _, total = await service.search(
            user_id=uuid4(),
            query_text="test",
            filters=SearchFilters(),
            page=1,
            page_size=50,
        )

        assert total == 3

    @pytest.mark.asyncio
    async def test_search_sorts_by_relevance_desc_by_default(self, service, mock_repo, mock_reranker):
        uids = _uuids(3)
        recipes = [_make_recipe(id=uid) for uid in uids]
        mock_repo.search_by_vector = AsyncMock(
            return_value=[(uids[0], 0.9), (uids[1], 0.5), (uids[2], 0.1)]
        )
        mock_repo.search_by_fulltext = AsyncMock(return_value=[])
        mock_repo.get_by_ids = AsyncMock(return_value=recipes)

        mock_reranker.rerank = MagicMock(return_value=recipes)

        result, _ = await service.search(
            user_id=uuid4(),
            query_text="test",
            filters=SearchFilters(),
            sort_by="relevance",
            sort_order="desc",
        )

        assert isinstance(result, list)
        assert all(isinstance(r, Recipe) for r in result)

    @pytest.mark.asyncio
    async def test_search_sorts_by_relevance_asc(self, service, mock_repo, mock_reranker):
        uids = _uuids(3)
        recipes = [_make_recipe(id=uid) for uid in uids]
        mock_repo.search_by_vector = AsyncMock(
            return_value=[(uids[0], 0.9), (uids[1], 0.5), (uids[2], 0.1)]
        )
        mock_repo.search_by_fulltext = AsyncMock(return_value=[])
        mock_repo.get_by_ids = AsyncMock(return_value=recipes)

        mock_reranker.rerank = MagicMock(return_value=list(reversed(recipes)))

        result, _ = await service.search(
            user_id=uuid4(),
            query_text="test",
            filters=SearchFilters(),
            sort_by="relevance",
            sort_order="asc",
        )

        assert isinstance(result, list)
        assert all(isinstance(r, Recipe) for r in result)

    @pytest.mark.asyncio
    async def test_search_sorts_by_duration_minutes(self, service, mock_repo, mock_reranker):
        uid1, uid2 = _uuids(2)
        r1 = _make_recipe(id=uid1, duration_minutes=45)
        r2 = _make_recipe(id=uid2, duration_minutes=15)
        recipes = [r1, r2]
        mock_repo.search_by_vector = AsyncMock(return_value=[(uid1, 0.9), (uid2, 0.8)])
        mock_repo.search_by_fulltext = AsyncMock(return_value=[])
        mock_repo.get_by_ids = AsyncMock(return_value=recipes)

        mock_reranker.rerank = MagicMock(return_value=recipes)

        result, _ = await service.search(
            user_id=uuid4(),
            query_text="test",
            filters=SearchFilters(),
            sort_by="duration_minutes",
            sort_order="asc",
        )

        durations = [r.duration_minutes for r in result]
        assert durations == [15, 45]

    @pytest.mark.asyncio
    async def test_search_missing_recipes_skipped(self, service, mock_repo, mock_reranker):
        uid1, uid2 = _uuids(2)
        r1 = _make_recipe(id=uid1)
        mock_repo.search_by_vector = AsyncMock(return_value=[(uid1, 0.9), (uid2, 0.5)])
        mock_repo.search_by_fulltext = AsyncMock(return_value=[])
        mock_repo.get_by_ids = AsyncMock(return_value=[r1])

        mock_reranker.rerank = MagicMock(return_value=[r1])

        result, total = await service.search(
            user_id=uuid4(), query_text="test", filters=SearchFilters()
        )

        assert total == 1
        assert len(result) == 1
        assert result[0].id == uid1
