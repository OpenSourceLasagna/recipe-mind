from typing import Annotated, AsyncGenerator

from fastapi import Depends, Request
from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

from src.database.repositories.ingredients_categories_repository import IngredientCategoryRepository
from src.database.repositories.recipe_ingredients_repository import RecipeIngredientRepository
from src.database.repositories.recipe_repository import RecipeRepository

from ..database.db import AsyncSessionLocal
from .auth import CurrentUserID

async def get_db_session(_request: Request, current_user_id: CurrentUserID) -> AsyncGenerator[AsyncSession]:
    async_session = AsyncSessionLocal()
    try:
        set_claim_statement = text("SELECT set_config('request.jwt.claim.sub', :user_id, true);")
        await super(AsyncSession, async_session).execute(set_claim_statement,
            {"user_id": str(current_user_id)}
        )
        yield async_session
    finally:
        await async_session.close()


async def get_recipe_repository(db: AsyncSession = Depends(get_db_session)) -> RecipeRepository:
    return RecipeRepository(a_session=db)

async def get_recipe_ingredient_repository(db: AsyncSession = Depends(get_db_session)) -> RecipeIngredientRepository:
    return RecipeIngredientRepository(a_session=db)

async def get_ingredient_category_repository(db: AsyncSession = Depends(get_db_session)) -> IngredientCategoryRepository:
    return IngredientCategoryRepository(a_session=db)

Database = Annotated[AsyncSessionLocal, Depends(get_db_session)]
RecipeRepo = Annotated[RecipeRepository, Depends(get_recipe_repository)]
RecipeIngredientRepo = Annotated[RecipeIngredientRepository, Depends(get_recipe_ingredient_repository)]
IngredientCategoryRepo = Annotated[IngredientCategoryRepository, Depends(get_ingredient_category_repository)]