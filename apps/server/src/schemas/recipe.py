from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import ConfigDict, Field

from src.schemas.camel_model import CamelModel
from src.schemas.ingredient import (
    RecipeIngredientCreate,
    RecipeIngredientResponse,
    RecipeIngredientUpdate,
)


class NutritionInfo(CamelModel):
    calories: float | None = None
    protein: float | None = None
    carbs: float | None = None
    fat: float | None = None

    model_config = ConfigDict(extra="forbid")


class CreateRecipeRequest(CamelModel):
    title: str
    ingredients: list[RecipeIngredientCreate] = Field(min_length=1)
    additional_information: list[str] = Field(default_factory=list)
    instruction_steps: list[str] = Field(default_factory=list)
    nutrition: NutritionInfo = Field(default_factory=NutritionInfo)
    servings: int = Field(default=4, ge=1)
    duration_minutes: int = Field(default=0, ge=0)
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    spice_level: int = Field(default=0, ge=0, le=5)
    origin: str = "Unknown"
    is_public: bool = False

    model_config = ConfigDict(extra="forbid")


class RecipeResponse(CamelModel):
    id: UUID
    title: str
    additional_information: list[str] = []
    instruction_steps: list[str] = []
    nutrition: NutritionInfo = Field(default_factory=NutritionInfo)
    servings: int
    duration_minutes: int
    difficulty: Literal["easy", "medium", "hard"]
    spice_level: int
    origin: str
    is_public: bool
    ingredients: list[RecipeIngredientResponse]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UpdateRecipeRequest(CamelModel):
    title: str | None = None
    ingredients: list[RecipeIngredientUpdate] | None = None
    additional_information: list[str] | None = None
    instruction_steps: list[str] | None = None
    nutrition: NutritionInfo | None = None
    servings: int | None = None
    duration_minutes: int | None = None
    difficulty: Literal["easy", "medium", "hard"] | None = None
    spice_level: int | None = None
    origin: str | None = None
    is_public: bool | None = None

    model_config = ConfigDict(extra="forbid")


class RecipeDetailResponse(RecipeResponse):
    is_owner: bool = False
