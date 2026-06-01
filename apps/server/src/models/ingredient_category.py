from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4
from functools import partial
from sqlmodel import Column, DateTime, ForeignKey, Relationship, SQLModel, Field, text

if TYPE_CHECKING:
    from src.models.recipe_ingredient import RecipeIngredient
    
class IngredientCategory(SQLModel, table=True):
    __tablename__ = "ingredient_categories" # pyright: ignore[reportAssignmentType]

    id: UUID = Field(
        default_factory=uuid4,
        primary_key=True,
        sa_column_kwargs={"server_default": text("gen_random_uuid()")}
    )
    
    category_name: str = Field(nullable=False, index=True)
    
    created_at: datetime = Field(
        default_factory=partial(datetime.now, UTC),
        sa_column=Column(DateTime(timezone=True), server_default=text("now()"))
    )

    centroid_id: UUID = Field(
        nullable=False,
        index=True,
        sa_column_args=[ForeignKey("recipe_ingredients.id")]
    )

    ingredients: list["RecipeIngredient"] = Relationship(
        back_populates="category",
        sa_relationship_kwargs={
            "lazy": "selectin",
            "foreign_keys": "RecipeIngredient.category_id",
        }
    )

    centroid: "RecipeIngredient" = Relationship(
        sa_relationship_kwargs={
            "lazy": "selectin",
            "foreign_keys": "IngredientCategory.centroid_id",
        }
    )
