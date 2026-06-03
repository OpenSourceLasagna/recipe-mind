from uuid import UUID

from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select

from src.models.ingredient_category import IngredientCategory


class IngredientCategoryRepository:
    def __init__(self, a_session: AsyncSession):
        self.a_session = a_session

    async def create(self, category: IngredientCategory) -> IngredientCategory:
        self.a_session.add(category)
        await self.a_session.commit()
        await self.a_session.refresh(category)
        return category

    async def get_by_id(self, category_id: UUID) -> IngredientCategory | None:
        return await self.a_session.get(IngredientCategory, category_id)

    async def get_all(self) -> list[IngredientCategory]:
        stmt = select(IngredientCategory)
        result = await self.a_session.exec(stmt)
        return list(result.all())

    async def get_by_name(self, name: str) -> IngredientCategory | None:
        stmt = select(IngredientCategory).where(IngredientCategory.category_name == name)
        result = await self.a_session.exec(stmt)
        return result.one_or_none()

    async def get_by_names(self, names: list[str]) -> list[IngredientCategory]:
        stmt = select(IngredientCategory).where(IngredientCategory.category_name.in_(names)) # type: ignore
        result = await self.a_session.exec(stmt)
        return list(result.all())
