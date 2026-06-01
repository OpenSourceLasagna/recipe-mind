from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import ConfigDict, Field

from src.schemas.camel_model import CamelModel
from src.schemas.ingredient import RecipeIngredientCreate, RecipeIngredientResponse


class CreateRecipeRequest(CamelModel):
    title: str
    ingredients: list[RecipeIngredientCreate] = Field(min_length=1)
    additional_information: list[str] = Field(default_factory=list)
    instruction_steps: list[str] = Field(default_factory=list)
    nutrition: dict[str, Any] = Field(default_factory=dict)
    servings: int = Field(default=4, ge=1)
    duration_minutes: int = Field(default=0, ge=0)
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    spice_level: int = Field(default=2, ge=1, le=5)
    origin: str = "Unknown"
    is_public: bool = False

    model_config = ConfigDict(extra="forbid")


class RecipeResponse(CamelModel):
    id: UUID
    title: str
    additional_information: list[str] = []
    instruction_steps: list[str] = []
    nutrition: dict[str, Any] = {}
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

