from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

from ..database.db import AsyncSessionLocal
from .auth import CurrentUserID

async def get_db_session(_request: Request, current_user_id: CurrentUserID):
    async_session = AsyncSessionLocal()
    try:
        set_claim_statement = text("SET LOCAL request.jwt.claim.sub = :user_id;")
        await super(AsyncSession, async_session).execute(set_claim_statement,
            {"user_id": current_user_id}
        )
        yield async_session
    finally:
        await async_session.close()

Database = Annotated[AsyncSessionLocal, Depends(get_db_session)]