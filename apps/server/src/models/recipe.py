from datetime import UTC, datetime
from functools import partial
from uuid import UUID, uuid4
from typing import Any
from sqlmodel import Index, SQLModel, Field, Column, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, TEXT
from sqlalchemy import CheckConstraint
from pgvector.sqlalchemy import VECTOR  # type: ignore

class Recipe(SQLModel, table=True):
    __tablename__ = "recipes" # type: ignore
    
    __table_args__ = (
        CheckConstraint(
            "difficulty IN ('easy', 'medium', 'hard')", 
            name="check_recipe_difficulty"
        ),
        CheckConstraint(
            "spice_level >= 1 AND spice_level <= 5", 
            name="check_recipe_spice_level"
        ),
        Index("idx_recipes_only_public", 
              "is_public", 
              postgresql_where=text("is_public = TRUE")
        ),
        Index("idx_recipes_embedding", 
              "embedding", 
              postgresql_using="ivfflat", 
              postgresql_ops={"embedding": "vector_cosine_ops"}, 
              postgresql_with={"lists": 10}
        )
    )

    id: UUID = Field(
        default_factory=uuid4, 
        primary_key=True,
        sa_column_kwargs={"server_default": text("gen_random_uuid()")}
    )
    user_id: UUID = Field(nullable=False, description="Matches your Supabase Auth user UUID", index=True)
    title: str = Field(nullable=False)

    additional_information: list[str] = Field(
        default=[],
        sa_column=Column(ARRAY(TEXT), server_default="{}")
    )
    instruction_steps: list[str] = Field(
        default=[],
        sa_column=Column(ARRAY(TEXT), server_default="{}")
    )

    nutrition: dict[str, Any] = Field(
        default={},
        sa_column=Column(JSONB, server_default="{}")
    )

    servings: int = Field(default=4, sa_column_kwargs={"server_default": "4"})
    duration_minutes: int = Field(default=0, sa_column_kwargs={"server_default": "0"}, index=True)
    difficulty: str = Field(default="medium", sa_column_kwargs={"server_default": "'medium'"}, index=True)
    spice_level: int = Field(default=2, sa_column_kwargs={"server_default": "2"}, index=True)
    origin: str = Field(default="Unknown", sa_column_kwargs={"server_default": "'Unknown'"})
    is_public: bool = Field(default=False, sa_column_kwargs={"server_default": "false"})

   
    embedding: Any = Field(default=None, sa_type=VECTOR(1536)) # type: ignore

    raw_source: str | None = Field(default=None)
    
    created_at: datetime = Field(
        default_factory=partial(datetime.now, UTC),
        sa_column_kwargs={"server_default": text("now()")}
    )
    updated_at: datetime = Field(
        default_factory=partial(datetime.now, UTC),
        sa_column_kwargs={"server_default": text("now()"), "onupdate": text("now()")}
    )