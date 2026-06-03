from dataclasses import dataclass

from src.models.recipe import Recipe


@dataclass
class ScoredRecipe:
    recipe: Recipe
    vector_score: float | None
    fts_score: float | None
    combined_score: float
