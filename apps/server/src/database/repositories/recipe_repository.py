from uuid import UUID

from sqlmodel.ext.asyncio.session import AsyncSession

from src.models.recipe import Recipe

class RecipeRepository:
    def __init__(self, a_session: AsyncSession):
        self.a_session = a_session

    async def create(self, recipe: Recipe) -> Recipe:
        """Persists a new recipe record to PostgreSQL."""
        self.a_session.add(recipe)
        await self.a_session.commit()
        await self.a_session.refresh(recipe)
        return recipe

    async def get_by_id(self, recipe_id: UUID) -> Recipe | None:
        """Retrieves a single recipe by its primary key id."""
        return await self.a_session.get(Recipe, recipe_id)