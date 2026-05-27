from datetime import datetime, timezone
from uuid import UUID, uuid4
from functools import partial
from sqlmodel import SQLModel, Field, text

class DietTag(SQLModel, table=True):
    __tablename__ = "diet_tags" # pyright: ignore[reportAssignmentType]

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

    tag_name: str = Field(
        nullable=False, 
        index=True
    )

    created_at: datetime = Field(
        default_factory=partial(datetime.now, timezone.utc),
        sa_column_kwargs={"server_default": text("now()")}
    )