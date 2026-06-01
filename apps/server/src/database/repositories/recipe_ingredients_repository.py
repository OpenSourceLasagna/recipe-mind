from uuid import UUID

from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, update

from src.models.ingredient_category import IngredientCategory
from src.models.recipe_ingredient import RecipeIngredient


class RecipeIngredientRepository:
    def __init__(self, a_session: AsyncSession):
        self.a_session = a_session

    async def create(self, ingredient: RecipeIngredient) -> RecipeIngredient:
        self.a_session.add(ingredient)
        await self.a_session.commit()
        await self.a_session.refresh(ingredient)
        return ingredient

    async def get_by_id(self, ingredient_id: UUID) -> RecipeIngredient | None:
        return await self.a_session.get(RecipeIngredient, ingredient_id)

    async def get_uncategorized(self) -> list[RecipeIngredient]:
        stmt = select(RecipeIngredient).where(RecipeIngredient.category_id.is_(None)) # type: ignore
        result = await self.a_session.exec(stmt)
        return list(result.all())

    async def get_categorized_by_normalized_names(
        self, names: list[str]
    ) -> list[RecipeIngredient]:
        stmt = select(RecipeIngredient).where(
            RecipeIngredient.normalized_name.in_(names), # type: ignore
            RecipeIngredient.category_id.isnot(None), # type: ignore
        )
        result = await self.a_session.exec(stmt)
        return list(result.all())

    async def get_centroids(self) -> list[RecipeIngredient]:
        subq = select(IngredientCategory.centroid_id).scalar_subquery()
        stmt = select(RecipeIngredient).where(RecipeIngredient.id.in_(subq)) # type: ignore
        result = await self.a_session.exec(stmt)
        return list(result.all())

    async def bulk_update_categories(
        self, mappings: list[tuple[UUID, UUID]]
    ) -> None:
        for ingredient_id, category_id in mappings:
            stmt = (
                update(RecipeIngredient)
                .where(RecipeIngredient.id == ingredient_id) # type: ignore
                .values(category_id=category_id)
            )
            await self.a_session.exec(stmt)
