from sqlalchemy.orm import declarative_base
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession
from core.config import get_settings


settings = get_settings()

database_url = str(settings.database_url)

async_engine = create_async_engine(database_url, echo=settings.debug)
AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)
Base = declarative_base()