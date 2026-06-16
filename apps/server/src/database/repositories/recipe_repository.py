from uuid import UUID

from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.models.recipe import Recipe
from src.models.recipe_ingredient import RecipeIngredient
from src.schemas.search import RecipeSearchQuery, SearchFilters

SORT_FIELD_MAP: dict[str, object] = {
    "created_at": Recipe.created_at,
    "is_public": Recipe.is_public,
    "duration_minutes": Recipe.duration_minutes,
    "title": Recipe.title,
    "spice_level": Recipe.spice_level,
    "difficulty": Recipe.difficulty,
}


class RecipeRepository:
    def __init__(self, a_session: AsyncSession):
        self.a_session = a_session

    async def create(self, recipe: Recipe) -> Recipe:
        self.a_session.add(recipe)
        await self.a_session.commit()
        await self.a_session.refresh(recipe)
        return recipe

    async def get_by_id(self, recipe_id: UUID) -> Recipe | None:
        return await self.a_session.get(Recipe, recipe_id)

    async def update(self, recipe: Recipe) -> Recipe:
        await self.a_session.commit()
        await self.a_session.refresh(recipe)
        return recipe

    async def delete(self, recipe: Recipe) -> None:
        for ing in recipe.ingredients:
            await self.a_session.delete(ing)
        await self.a_session.delete(recipe)
        await self.a_session.commit()

    async def get_by_ids(self, ids: list[UUID]) -> list[Recipe]:
        if not ids:
            return []
        stmt = select(Recipe).where(Recipe.id.in_(ids))  # type: ignore
        result = await self.a_session.exec(stmt)
        return list(result.all())

    async def search(
        self,
        user_id: UUID,
        query: RecipeSearchQuery,
        ingredient_category_ids: list[UUID] | None = None,
    ) -> tuple[list[Recipe], int]:
        filters = query.to_filters(ingredient_category_ids)
        conditions = self._build_filter_conditions(user_id=user_id, filters=filters)

        if query.query:
            conditions.append(Recipe.title.ilike(f"%{query.query}%"))  # type: ignore

        stmt = select(Recipe).where(*conditions)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await self.a_session.exec(count_stmt)
        total = total_result.one()

        sort_field = query.sort_by if query.sort_by in SORT_FIELD_MAP else "created_at"
        order_column = SORT_FIELD_MAP[sort_field]
        order_expr = (  # type: ignore
            order_column.asc() if query.sort_order == "asc" else order_column.desc()  # type: ignore
        )
        stmt = stmt.order_by(order_expr)  # type: ignore

        offset = (query.page - 1) * query.page_size
        stmt = stmt.offset(offset).limit(query.page_size)

        result = await self.a_session.exec(stmt)
        recipes = list(result.all())

        return recipes, total

    async def search_by_vector(
        self,
        embedding: list[float],
        user_id: UUID,
        filters: SearchFilters,
        limit: int = 100,
    ) -> list[tuple[UUID, float]]:
        conditions = self._build_filter_conditions(user_id=user_id, filters=filters)
        conditions.append(Recipe.embedding.is_not(None))

        distance = Recipe.embedding.cosine_distance(embedding)
        score = (1 - distance).label("vector_score")

        stmt = (
            select(Recipe.id, score)
            .where(*conditions)
            .order_by(distance.asc())
            .limit(limit)
        )

        result = await self.a_session.exec(stmt)
        return [(row[0], float(row[1])) for row in result.all()]

    async def search_by_fulltext(
        self,
        query_text: str,
        user_id: UUID,
        filters: SearchFilters,
        limit: int = 100,
    ) -> list[tuple[UUID, float]]:
        conditions = self._build_filter_conditions(user_id=user_id, filters=filters)

        ts_query = func.plainto_tsquery("english", query_text)
        conditions.append(Recipe.search_vector.op("@@")(ts_query))

        fts_score = func.ts_rank(Recipe.search_vector, ts_query).label("fts_score")

        stmt = (
            select(Recipe.id, fts_score)
            .where(*conditions)
            .order_by(fts_score.desc())
            .limit(limit)
        )

        result = await self.a_session.exec(stmt)
        return [(row[0], float(row[1])) for row in result.all()]

    def _build_filter_conditions(
        self,
        user_id: UUID,
        filters: SearchFilters,
    ) -> list[bool]:
        conditions: list[bool] = [
            (Recipe.is_public == True) | (Recipe.user_id == user_id)  # noqa: E712
        ]

        if filters.difficulty:
            conditions.append(Recipe.difficulty == filters.difficulty)
        if filters.spice_level_min is not None:
            conditions.append(Recipe.spice_level >= filters.spice_level_min)
        if filters.spice_level_max is not None:
            conditions.append(Recipe.spice_level <= filters.spice_level_max)
        if filters.duration_min is not None:
            conditions.append(Recipe.duration_minutes >= filters.duration_min)
        if filters.duration_max is not None:
            conditions.append(Recipe.duration_minutes <= filters.duration_max)
        if filters.servings_min is not None:
            conditions.append(Recipe.servings >= filters.servings_min)
        if filters.servings_max is not None:
            conditions.append(Recipe.servings <= filters.servings_max)
        if filters.origin:
            conditions.append(Recipe.origin.ilike(f"%{filters.origin}%"))  # type: ignore
        if filters.ingredient_category_ids:
            target_categories = list(set(filters.ingredient_category_ids))
            category_count = len(target_categories)

            category_stmt = (
                select(RecipeIngredient.recipe_id)
                .where(RecipeIngredient.category_id.in_(target_categories))  # type: ignore
                .group_by(RecipeIngredient.recipe_id)  # type: ignore
                .having(
                    func.count(RecipeIngredient.category_id.distinct())
                    == category_count
                )  # type: ignore
            )

            conditions.append(Recipe.id.in_(category_stmt))  # type: ignore

        return conditions
