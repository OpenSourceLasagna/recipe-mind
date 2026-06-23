from dataclasses import dataclass, field
from typing import Literal
from uuid import UUID

from pydantic import Field

from src.schemas.camel_model import CamelModel
from src.schemas.recipe import RecipeResponse


@dataclass
class SearchFilters:
    difficulty: str | None = None
    spice_level_min: int | None = None
    spice_level_max: int | None = None
    duration_min: int | None = None
    duration_max: int | None = None
    servings_min: int | None = None
    servings_max: int | None = None
    origin: str | None = None
    ingredient_category_ids: list[UUID] | None = field(default=None)


class RecipeSearchQuery(CamelModel):
    query: str | None = Field(
        default=None, description="Text query for hybrid vector + full-text search"
    )
    difficulty: Literal["easy", "medium", "hard"] | None = None
    spice_level_min: int | None = Field(default=None, ge=0, le=5)
    spice_level_max: int | None = Field(default=None, ge=0, le=5)
    duration_min: int | None = Field(default=None, ge=0)
    duration_max: int | None = Field(default=None, ge=0)
    servings_min: int | None = Field(default=None, ge=1)
    servings_max: int | None = Field(default=None, ge=0)
    origin: str | None = Field(default=None, description="ILIKE match on origin")
    ingredient_categories: str | None = Field(
        default=None, description="Comma-separated ingredient category names"
    )
    sort_by: Literal[
        "relevance",
        "created_at",
        "is_public",
        "duration_minutes",
        "title",
        "spice_level",
        "difficulty",
    ] = Field(default="created_at")
    sort_order: Literal["asc", "desc"] = Field(default="desc")
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=50)

    def to_filters(
        self, ingredient_category_ids: list[UUID] | None = None
    ) -> "SearchFilters":
        return SearchFilters(
            difficulty=self.difficulty,
            spice_level_min=self.spice_level_min,
            spice_level_max=self.spice_level_max,
            duration_min=self.duration_min,
            duration_max=self.duration_max,
            servings_min=self.servings_min,
            servings_max=self.servings_max,
            origin=self.origin,
            ingredient_category_ids=ingredient_category_ids,
        )


class RecipeSearchResponse(CamelModel):
    items: list[RecipeResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
