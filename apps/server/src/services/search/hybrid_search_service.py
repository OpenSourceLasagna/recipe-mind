from dataclasses import dataclass
from datetime import datetime
from typing import Callable
from uuid import UUID

from src.database.repositories.query_cache_repository import QueryCacheRepository
from src.database.repositories.recipe_repository import RecipeRepository
from src.models.query_cache import QueryCache
from src.models.recipe import Recipe
from src.schemas.search import SearchFilters
from src.services.embeddings.base_embedding_service import BaseEmbeddingService
from src.services.search.reranking_service import RerankingService
from src.services.search.types import ScoredRecipe


@dataclass
class _ScoredCandidate:
    recipe_id: UUID
    vector_score: float | None
    fts_score: float | None
    combined_score: float


def _sort_key_for(field: str):
    keys: dict[str, Callable[[Recipe], str | datetime | int]] = {
        "created_at": lambda sr: sr.created_at,
        "duration_minutes": lambda sr: sr.duration_minutes,
        "title": lambda sr: sr.title,
        "spice_level": lambda sr: sr.spice_level,
        "difficulty": lambda sr: sr.difficulty,
        "is_public": lambda sr: sr.is_public,
    }
    return keys.get(field, lambda sr: sr.created_at)


class HybridSearchService:
    VECTOR_WEIGHT = 0.5
    FTS_WEIGHT = 0.5
    CANDIDATE_SELECTION_LIMIT = 200
    CANDIDATE_LIMIT = 100

    def __init__(
        self,
        recipe_repo: RecipeRepository,
        embedder: BaseEmbeddingService,
        reranker: RerankingService,
        cache_repo: QueryCacheRepository,
    ):
        self._repo = recipe_repo
        self._embedder = embedder
        self._reranker = reranker
        self._cache_repo = cache_repo

    async def search(
        self,
        user_id: UUID,
        query_text: str,
        filters: SearchFilters,
        sort_by: str = "relevance",
        sort_order: str = "desc",
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Recipe], int]:
        cached = await self._cache_repo.get_by_query(query_text)
        if cached and cached.embedding is not None:
            embedding = cached.embedding
        else:
            embedding = await self._embedder.embed(query_text)
            await self._cache_repo.create(
                QueryCache(query_string=query_text, embedding=embedding)
            )

        vector_results = await self._repo.search_by_vector(
            embedding=embedding,
            user_id=user_id,
            filters=filters,
            limit=self.CANDIDATE_SELECTION_LIMIT,
        )
        fts_results = await self._repo.search_by_fulltext(
            query_text=query_text,
            user_id=user_id,
            filters=filters,
            limit=self.CANDIDATE_SELECTION_LIMIT,
        )

        candidates = self._merge_results(vector_results, fts_results)

        all_ids = [c.recipe_id for c in candidates]
        recipes = await self._repo.get_by_ids(all_ids)
        recipe_map = {r.id: r for r in recipes}

        scored_recipes = [
            ScoredRecipe(
                recipe=recipe_map[c.recipe_id],
                vector_score=c.vector_score,
                fts_score=c.fts_score,
                combined_score=c.combined_score,
            )
            for c in candidates
            if c.recipe_id in recipe_map
        ]

        scored_recipes.sort(key=lambda sr: sr.combined_score, reverse=True)

        ranked_recipes: list[Recipe] = self._reranker.rerank(
            scored_recipes[: self.CANDIDATE_LIMIT], query_text
        )

        total = len(ranked_recipes)

        if sort_by == "relevance":
            if sort_order == "asc":
                ranked_recipes.reverse()
        else:
            key_fn = _sort_key_for(sort_by)
            ranked_recipes.sort(key=key_fn, reverse=(sort_order == "desc"))

        start = (page - 1) * page_size
        end = start + page_size
        paginated = ranked_recipes[start:end]

        return paginated, total

    def _merge_results(
        self,
        vector_results: list[tuple[UUID, float]],
        fts_results: list[tuple[UUID, float]],
    ) -> list[_ScoredCandidate]:
        vector_map = dict(vector_results)
        fts_map = dict(fts_results)

        v_min, _, v_range = self._normalize_range(vector_map)
        f_min, _, f_range = self._normalize_range(fts_map)

        all_ids = set(vector_map) | set(fts_map)
        candidates: list[_ScoredCandidate] = []

        for recipe_id in all_ids:
            v_score = vector_map.get(recipe_id)
            f_score = fts_map.get(recipe_id)

            norm_v = (v_score - v_min) / v_range if v_score is not None else 0.0
            norm_f = (f_score - f_min) / f_range if f_score is not None else 0.0

            combined = self.VECTOR_WEIGHT * norm_v + self.FTS_WEIGHT * norm_f

            candidates.append(
                _ScoredCandidate(
                    recipe_id=recipe_id,
                    vector_score=v_score,
                    fts_score=f_score,
                    combined_score=combined,
                )
            )

        candidates.sort(key=lambda c: c.combined_score, reverse=True)
        return candidates

    @staticmethod
    def _normalize_range(scores: dict[UUID, float]) -> tuple[float, float, float]:
        if not scores:
            return 0.0, 0.0, 1.0
        min_val = min(scores.values())
        max_val = max(scores.values())
        return min_val, max_val, max_val - min_val if max_val != min_val else 1.0
