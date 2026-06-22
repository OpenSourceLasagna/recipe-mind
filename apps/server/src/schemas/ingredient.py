from uuid import UUID

from pydantic import ConfigDict

from src.schemas.camel_model import CamelModel


class RecipeIngredientCreate(CamelModel):
    ingredient_name: str
    quantity: float = 1.0
    unit: str = ""

    model_config = ConfigDict(extra="forbid")


class RecipeIngredientUpdate(CamelModel):
    id: UUID | None = None
    ingredient_name: str
    quantity: float = 1.0
    unit: str = ""


class RecipeIngredientResponse(CamelModel):
    id: UUID | None = None
    ingredient_name: str
    quantity: float
    unit: str
    category_id: UUID | None = None

    model_config = ConfigDict(from_attributes=True)
