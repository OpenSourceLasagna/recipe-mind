from typing import cast

from sentence_transformers import CrossEncoder

from src.models.recipe import Recipe
from src.services.recipe_serializer import RecipeSerializerService
from src.services.search.types import ScoredRecipe
from src.utils.get_save_model import get_save_cross_encoder_path


class RerankingService:
    def __init__(
        self,
        recipe_preprocessor: RecipeSerializerService,
        model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2",
        model_base_path: str = "./local_models",
        below_best_match_threshold: float = 3.0,
    ):
        saved_path = get_save_cross_encoder_path(
            base_path=model_base_path,
            model_name=model_name,
        )
        self._model = CrossEncoder(str(saved_path))
        self._recipe_preprocessor = recipe_preprocessor
        self._below_best_match_threshold = below_best_match_threshold

    def rerank(self, scored: list[ScoredRecipe], query: str) -> list[Recipe]:
        if not scored:
            return []

        recipe_corpus = [self._recipe_preprocessor.to_rerank_markdown(r.recipe) for r in scored]
        ranks = self._model.rank(query, recipe_corpus)  # type: ignore

        results: list[Recipe] = []
        best_score = max(cast(float, rank["score"]) for rank in ranks)
        min_acceptable_score = best_score - self._below_best_match_threshold
        for rank in ranks:
            if cast(float, rank["score"]) < min_acceptable_score:
                continue
            results.append(scored[cast(int, rank["corpus_id"])].recipe)

        return results
