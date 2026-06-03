from datetime import UTC, datetime
from functools import partial
from typing import Any
from uuid import UUID, uuid4

from pgvector.sqlalchemy import VECTOR
from sqlalchemy.dialects.postgresql import TEXT
from sqlalchemy import Column, text
from sqlmodel import DateTime, Field, SQLModel

from src.core.config import settings


class QueryCache(SQLModel, table=True):
    __tablename__ = "query_cache"  # type: ignore

    id: UUID = Field(
        default_factory=uuid4,
        primary_key=True,
        sa_column_kwargs={"server_default": text("gen_random_uuid()")},
    )
    query_string: str = Field(
        sa_column=Column(TEXT, nullable=False, unique=True),
    )
    embedding: Any = Field(default=None, sa_type=VECTOR(settings.embedding_size))  # type: ignore
    created_at: datetime = Field(
        default_factory=partial(datetime.now, UTC),
        sa_column=Column(DateTime(timezone=True), server_default=text("now()")),
    )
