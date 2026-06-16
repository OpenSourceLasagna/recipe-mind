class TestDatabaseModule:
    def test_declarative_base_exists(self):
        from sqlalchemy.orm import DeclarativeMeta
        from src.database.db import Base

        assert isinstance(Base, DeclarativeMeta)

    async def test_async_session_local_is_callable(self):
        from src.database.db import AsyncSessionLocal

        assert callable(AsyncSessionLocal)
