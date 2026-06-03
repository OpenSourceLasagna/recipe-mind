from uuid import UUID

from sqlmodel.ext.asyncio.session import AsyncSession
from src.models.query_cache import QueryCache
from sqlmodel import select

class QueryCacheRepository:
    def __init__(self, a_session: AsyncSession):
        self.a_session = a_session

    async def get_by_query(self, query_string: str) -> QueryCache | None:
        stmt = select(QueryCache).where(QueryCache.query_string == query_string)  # type: ignore
        result = await self.a_session.exec(stmt)
        return result.one_or_none()

    async def create(self, query_cache: QueryCache) -> QueryCache:
        self.a_session.add(query_cache)
        await self.a_session.commit()
        await self.a_session.refresh(query_cache)
        return query_cache
