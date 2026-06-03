from uuid import UUID

from src.schemas.camel_model import CamelModel


class IngredientCategoryResponseItem(CamelModel):
    id: UUID
    category_name: str
