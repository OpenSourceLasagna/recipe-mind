from datetime import UTC, datetime
from uuid import UUID, uuid4
from typing import TYPE_CHECKING, Any
from functools import partial
from sqlmodel import Column, DateTime, Float, ForeignKey, Relationship, SQLModel, Field, text
from pgvector.sqlalchemy import Vector # pyright: ignore[reportMissingTypeStubs]

from src.core.config import settings

if TYPE_CHECKING:
    from src.models.recipe import Recipe
    from src.models.ingredient_category import IngredientCategory

class RecipeIngredient(SQLModel, table=True):
    __tablename__ = "recipe_ingredients" # pyright: ignore[reportAssignmentType]

    id: UUID = Field(
        default_factory=uuid4,
        primary_key=True,
        sa_column_kwargs={"server_default": text("gen_random_uuid()")}
    )

    recipe_id: UUID = Field(
        nullable=False,
        index=True,
        sa_column_args=[ForeignKey("recipes.id", ondelete="CASCADE")]
    )

    category_id: UUID | None = Field(
        default=None,
        sa_column_args=[ForeignKey("ingredient_categories.id", ondelete="SET NULL")]
    )

    ingredient_name: str = Field(
        nullable=False,
        index=True
    )

    normalized_name: str | None = Field(
        nullable=True,
        index=True,
        default=None
    )

    quantity: float = Field(
        sa_column=Column(
            Float,
            default=1.0,
            server_default=text("1.0"),
            nullable=False
        )
    )
    unit: str = Field(
        default="",
        sa_column_kwargs={"server_default": "''"}
    )

    embedding: Any = Field(
        default=None,
        sa_type=Vector(settings.local_embedding_size) # pyright: ignore[reportArgumentType]
    )

    created_at: datetime = Field(
        default_factory=partial(datetime.now, UTC),
        sa_column=Column(DateTime(timezone=True), server_default=text("now()"))
    )

    recipe: "Recipe" = Relationship(
        back_populates='ingredients',
        sa_relationship_kwargs={"lazy": "selectin"}
    )

    category: "IngredientCategory" = Relationship(
        back_populates='ingredients',
        sa_relationship_kwargs={
            "lazy": "selectin",
            "foreign_keys": "RecipeIngredient.category_id",
        }
    )
