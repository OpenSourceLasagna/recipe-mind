from datetime import UTC, datetime
from uuid import UUID, uuid4
from functools import partial
from sqlmodel import Column, DateTime, ForeignKey, SQLModel, Field, text


class DietTag(SQLModel, table=True):
    __tablename__ = "diet_tags"  # pyright: ignore[reportAssignmentType]

    id: UUID = Field(
        default_factory=uuid4,
        primary_key=True,
        sa_column_kwargs={"server_default": text("gen_random_uuid()")},
    )

    recipe_id: UUID = Field(
        nullable=False,
        index=True,
        sa_column_args=[ForeignKey("recipes.id", ondelete="CASCADE")],
    )

    tag_name: str = Field(nullable=False, index=True)

    created_at: datetime = Field(
        default_factory=partial(datetime.now, UTC),
        sa_column=Column(DateTime(timezone=True), server_default=text("now()")),
    )
