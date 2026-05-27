from datetime import datetime, timezone
from uuid import UUID, uuid4
from typing import Any
from functools import partial
from sqlmodel import SQLModel, Field, text
from pgvector.sqlalchemy import Vector # pyright: ignore[reportMissingTypeStubs]

class RecipeIngredient(SQLModel, table=True):
    __tablename__ = "recipe_ingredients" # pyright: ignore[reportAssignmentType]

    id: UUID = Field(
        default_factory=uuid4,
        primary_key=True,
        sa_column_kwargs={"server_default": text("gen_random_uuid()")}
    )

    recipe_id: UUID = Field(
        foreign_key="recipes.id",
        nullable=False,
        index=True,
        sa_column_kwargs={"ondelete": "CASCADE"}
    )
    
    category_id: UUID | None = Field(
        default=None,
        foreign_key="ingredient_categories.id",
        sa_column_kwargs={"ondelete": "SET NULL"}
    )

    ingredient_name: str = Field(
        nullable=False, 
        index=True
    )
    quantity: float = Field(
        default=1.0, 
        sa_column_kwargs={"server_default": "1.0"}
    )
    unit: str = Field(
        default="", 
        sa_column_kwargs={"server_default": "''"}
    )

    embedding: Any = Field(
        default=None, 
        sa_type=Vector(384) # pyright: ignore[reportArgumentType]
    )

    created_at: datetime = Field(
        default_factory=partial(datetime.now, timezone.utc),
        sa_column_kwargs={"server_default": text("now()")}
    )