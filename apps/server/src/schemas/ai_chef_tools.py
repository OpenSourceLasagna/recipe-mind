from typing import Literal

from pydantic import ConfigDict, Field

from src.schemas.camel_model import CamelModel


class SearchRecipesToolParams(CamelModel):
    model_config = ConfigDict(extra="forbid")

    query: str = Field(
        description=(
            "Refined search query for recipe discovery. "
            "Use specific terms like ingredients, cuisines, or dish names "
            "(e.g. 'vegan pasta', 'quick Mexican dinner')."
        ),
    )
    max_results: int = Field(
        ge=1,
        le=10,
        description="Number of recipes to return, between 1 and 10.",
    )


class GetRecipeByIdToolParams(CamelModel):
    model_config = ConfigDict(extra="forbid")

    recipe_id: str = Field(
        description=(
            "UUID of the recipe to retrieve. "
            "MUST call this tool before modifying a recipe to ensure "
            "you have the current recipe details."
        ),
    )


class RecipeIngredientPatch(CamelModel):
    model_config = ConfigDict(extra="forbid")

    ingredient_name: str = Field(description="Name of the ingredient.")
    quantity: float = Field(description="Amount of the ingredient.")
    unit: str = Field(description="Unit of measurement (e.g. 'cups', 'tbsp').")


class NutritionPatch(CamelModel):
    model_config = ConfigDict(extra="forbid")

    calories: int | None = None
    protein: float | None = None
    fat: float | None = None
    carbs: float | None = None


class RecipePatch(CamelModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(
        default=None, description="New recipe title, or null to keep original."
    )
    additional_information: list[str] | None = Field(
        default=None,
        description="Replaces the additional information list. Include ALL items.",
    )
    instruction_steps: list[str] | None = Field(
        default=None,
        description="Replaces the instruction steps. Include ALL steps, not only changed ones.",
    )
    nutrition: NutritionPatch | None = Field(
        default=None,
        description="Merged into original nutrition. Provide only keys to add or change.",
    )
    servings: int | None = Field(
        default=None, description="New number of servings, or null to keep original."
    )
    duration_minutes: int | None = Field(
        default=None,
        description="New cooking duration in minutes, or null to keep original.",
    )
    difficulty: Literal["easy", "medium", "hard"] | None = Field(
        default=None,
        description="New difficulty level, or null to keep original.",
    )
    spice_level: int | None = Field(
        default=None, description="New spice level (1-5), or null to keep original."
    )
    origin: str | None = Field(
        default=None, description="New cuisine origin, or null to keep original."
    )
    is_public: bool | None = Field(
        default=None, description="New visibility flag, or null to keep original."
    )
    ingredients: list[RecipeIngredientPatch] | None = Field(
        default=None,
        description=(
            "Replaces the entire ingredients list. "
            "Include ALL ingredients (original + changes), "
            "not only the ones you want to change."
        ),
    )
